import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/options";

setGlobalOptions({ region: "southamerica-east1" });

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export const calculatepointsonmatchfinish = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const newData = event.data?.after.data();
    const oldData = event.data?.before.data();
    const matchId = event.params.matchId;

    if (!newData || !oldData) return;

    if (newData["status"] === "finished" && oldData["status"] !== "finished") {
      const hScore = newData["homeScore"];
      const aScore = newData["awayScore"];

      const predictionsSnap = await db.collection("predictions")
        .where("matchId", "==", matchId)
        .get();

      if (predictionsSnap.empty) return;

      const batch = db.batch();

      predictionsSnap.docs.forEach((doc) => {
        const pred = doc.data();
        let points = 0;

        const exact = pred["homeScore"] === hScore &&
          pred["awayScore"] === aScore;

        const actRes = hScore > aScore ? "H" : hScore < aScore ? "A" : "D";
        const preRes = pred["homeScore"] > pred["awayScore"] ?
          "H" : pred["homeScore"] < pred["awayScore"] ? "A" : "D";

        if (exact) {
          points = 3;
        } else if (actRes === preRes) {
          points = 1;
        }

        batch.update(doc.ref, { points: points, processed: true });

        const userRef = db.collection("users").doc(pred["userId"]);
        batch.update(userRef, {
          totalPoints: admin.firestore.FieldValue.increment(points),
        });
      });

      await batch.commit();
    }
  },
);
