import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/options";

setGlobalOptions({region: "southamerica-east1"});

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const calculatePointsOnMatchFinish = onDocumentUpdated(
  "tournaments/{tourId}/matches/{matchId}",
  async (event: any) => {
    const newData = event.data?.after.data();
    const oldData = event.data?.before.data();
    const matchId = event.params.matchId;

    if (!newData || !oldData) return;

    if (newData.status === "finished" && oldData.status !== "finished") {
      const hScore = newData.homeScore;
      const aScore = newData.awayScore;

      const predictionsSnap = await db.collection("predictions")
        .where("matchId", "==", matchId)
        .get();

      if (predictionsSnap.empty) return;

      const batch = db.batch();

      predictionsSnap.docs.forEach((doc) => {
        const pred = doc.data();
        const hS = Number(hScore);
        const aS = Number(aScore);
        const pH = Number(pred.homeScore);
        const pA = Number(pred.awayScore);

        let points = 0;

        const exact = pH === hS && pA === aS;
        const actualTrend = hS > aS ? "H" : hS < aS ? "A" : "D";
        const predTrend = pH > pA ? "H" : pH < pA ? "A" : "D";
        const trendCorrect = actualTrend === predTrend;
        const oneScoreCorrect = (pH === hS || pA === aS);

        if (exact) {
          points = 5;
        } else if (trendCorrect) {
          points = 2;
        } else if (oneScoreCorrect) {
          points = 1;
        }

        batch.update(doc.ref, {points: points, processed: true});

        const userRef = db.collection("users").doc(pred.userId);
        batch.update(userRef, {
          totalPoints: FieldValue.increment(points),
        });
      });


      await batch.commit();
    }
  },
);

