import { useEffect, useRef, useState } from 'react';

type EffectName = 'tap' | 'correct' | 'retry';
type Settings = { music: number; effects: number; muted: boolean };
type Players = Record<EffectName | 'theme', HTMLAudioElement>;
const key = 'accounting-play-sound-v2';
const defaults: Settings = { music: 15, effects: 30, muted: false };
function load(): Settings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!raw || typeof raw !== 'object') return defaults;
    const s = raw as Partial<Settings>;
    const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
    return { music: volume(s.music, 15), effects: volume(s.effects, 30), muted: typeof s.muted === 'boolean' ? s.muted : false };
  } catch { return defaults; }
}
export function useSound() {
  const [settings, setSettings] = useState<Settings>(load);
  const current = useRef(settings);
  const players = useRef<Players | null>(null);
  const started = useRef(false);
  const sync = () => {
    const audio = players.current;
    if (!audio) return;
    const s = current.current;
    audio.theme.volume = s.music / 100;
    for (const name of ['tap', 'correct', 'retry'] as const) {
      audio[name].volume = s.effects / 100;
      if (s.muted || document.hidden || s.effects === 0) audio[name].pause();
    }
    if (!started.current || s.muted || document.hidden || s.music === 0) audio.theme.pause();
    else if (audio.theme.paused) void audio.theme.play().catch(() => {});
  };
  useEffect(() => {
    const audio = Object.fromEntries(['theme', 'tap', 'correct', 'retry'].map(name => {
      const item = new Audio(`/media/${name}.mp3`);
      item.preload = 'none';
      item.loop = name === 'theme';
      return [name, item];
    })) as Players;
    players.current = audio;
    const gesture = () => { started.current = true; sync(); };
    const visibility = () => {
      if (document.hidden) Object.values(audio).forEach(item => item.pause());
      else sync();
    };
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', gesture);
      document.removeEventListener('keydown', gesture);
      document.removeEventListener('visibilitychange', visibility);
      Object.values(audio).forEach(item => { item.pause(); item.removeAttribute('src'); item.load(); });
      players.current = null;
    };
  }, []);
  const update = (patch: Partial<Settings>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    started.current = true;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
    sync();
  };
  const play = (name: EffectName) => {
    started.current = true;
    sync();
    const audio = players.current;
    const s = current.current;
    if (!audio || s.muted || s.effects === 0 || document.hidden) return;
    for (const effect of ['tap', 'correct', 'retry'] as const) audio[effect].pause();
    audio[name].currentTime = 0;
    void audio[name].play().catch(() => {});
  };
  return {
    ...settings, play,
    toggle: () => update({ muted: !current.current.muted }),
    setMusic: (music: number) => update({ music: Math.max(0, Math.min(100, music)) }),
    setEffects: (effects: number) => update({ effects: Math.max(0, Math.min(100, effects)) }),
  };
}
