import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-12 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header class="text-center space-y-4">
        <h1 class="text-5xl font-black text-slate-900 tracking-tight italic uppercase">
          Reglamento <span class="text-indigo-600">Prodeus</span>
        </h1>

        <p class="text-slate-500 font-medium text-lg max-w-2xl mx-auto">
          Demuestra tus conocimientos futbolísticos y compite con tus compañeros. ¡Aprende cómo sumar al máximo!
        </p>
      </header>

      <!-- Sistema de Puntuación -->
      <section class="space-y-6">
        <h2 class="text-2xl font-black text-slate-800 flex items-center gap-3">
          <span class="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">🎯</span>
          Sistema de Puntuación
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Acierto Pleno -->
          <div class="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-indigo-500 transition-all group">
            <div class="flex items-center gap-4 mb-3">
              <div class="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform font-bold">5</div>
              <div>
                <h3 class="font-black text-slate-800 uppercase text-sm tracking-widest">Acierto Pleno</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase">Resultado Exacto</p>
              </div>
            </div>
            <p class="text-sm text-slate-500 leading-snug">Si aciertas el resultado exacto (Goles Local y Goles Visitante), sumas el máximo puntaje.</p>
          </div>

          <!-- Acierto Parcial -->
          <div class="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-indigo-500 transition-all group">
            <div class="flex items-center gap-4 mb-3">
              <div class="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform font-bold">2</div>
              <div>
                <h3 class="font-black text-slate-800 uppercase text-sm tracking-widest">Acierto de Tendencia</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase">Ganador o Empate</p>
              </div>
            </div>
            <p class="text-sm text-slate-500 leading-snug">Si aciertas quién gana el partido (o el empate), pero no los goles exactos.</p>
          </div>

          <!-- Acierto Goles -->
          <div class="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-indigo-500 transition-all group">
            <div class="flex items-center gap-4 mb-3">
              <div class="h-12 w-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform font-bold">1</div>
              <div>
                <h3 class="font-black text-slate-800 uppercase text-sm tracking-widest">Acierto de Goles</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase">Puntaje por equipo</p>
              </div>
            </div>
            <p class="text-sm text-slate-500 leading-snug">Si aciertas la cantidad de goles de uno de los equipos, aunque pierdas la tendencia.</p>
          </div>

          <!-- Error Total -->
          <div class="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:border-slate-300 transition-all group">
            <div class="flex items-center gap-4 mb-3">
              <div class="h-12 w-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform font-bold">0</div>
              <div>
                <h3 class="font-black text-slate-800 uppercase text-sm tracking-widest">Sin Aciertos</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase">Error de Pronóstico</p>
              </div>
            </div>
            <p class="text-sm text-slate-500 leading-snug">Si no aciertas ni la tendencia ni la cantidad de goles de ningún equipo.</p>
          </div>
        </div>
      </section>

      <!-- Consideraciones Generales -->
      <section class="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div class="relative z-10 space-y-6">
          <h2 class="text-2xl font-black flex items-center gap-3">
            <span class="h-10 w-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-lg">⚖️</span>
            Reglas Generales
          </h2>
          <ul class="space-y-4">
            <li class="flex gap-4">
              <span class="h-6 w-6 shrink-0 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <h4 class="font-bold text-indigo-400">Tiempo Límite</h4>
                <p class="text-sm text-slate-300">Puedes guardar o modificar tu pronóstico hasta antes de que el partido comience. Una vez iniciado, el sistema bloquea los cambios automáticamente.</p>
              </div>
            </li>
            <li class="flex gap-4">
              <span class="h-6 w-6 shrink-0 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <h4 class="font-bold text-indigo-400">Actualización del Ranking</h4>
                <p class="text-sm text-slate-300">Los puntos se procesan una vez el administrador finaliza el partido. Los cambios en el leaderboard son instantáneos tras el proceso.</p>
              </div>
            </li>
            <li class="flex gap-4">
              <span class="h-6 w-6 shrink-0 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <h4 class="font-bold text-indigo-400">Desempates</h4>
                <p class="text-sm text-slate-300">En caso de igualdad de puntos, los usuarios compartirán la posición actual en el ranking.</p>
              </div>
            </li>
          </ul>
        </div>
        <!-- Decoración -->
        <div class="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-600 opacity-20 blur-3xl"></div>
      </section>
      
      <footer class="text-center pt-10">
        <p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest">¡Que gane el mejor! ⚽🏆</p>
      </footer>
    </div>
  `
})
export class RulesComponent {}
