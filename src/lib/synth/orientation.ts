import { useCallback, useSyncExternalStore } from "react";

export type Tilt = 0 | 90 | -90;
export type SensorState = "idle" | "granted" | "denied" | "unsupported";

export type PlayLayout = {
  wide: boolean;
  turn: Tilt;
  forced: boolean;
  sideways: boolean;
  sensor: SensorState;
};

type Snapshot = {
  wide: boolean;
  turn: Tilt;
  forced: boolean;
  sensor: SensorState;
};

const listeners = new Set<() => void>();

let snapshot: Snapshot = {
  wide: false,
  turn: 0,
  forced: false,
  sensor: "idle",
};

let started = false;
let sensorsBound = false;

function emit() {
  snapshot = { ...snapshot };
  for (const fn of listeners) fn();
  const sideways = snapshot.wide || snapshot.turn !== 0;
  document.documentElement.dataset.play = sideways ? "wide" : "tall";
  document.body.style.overflow = snapshot.turn !== 0 ? "hidden" : "";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  bindViewport();
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return snapshot;
}

function viewportWide() {
  return window.innerWidth > window.innerHeight + 24;
}

function screenAngle(): number {
  const orient = window.screen?.orientation;
  if (orient && typeof orient.angle === "number") return orient.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

function turnFromAngle(angle: number): Tilt {
  const a = ((angle % 360) + 360) % 360;
  if (a === 90) return 90;
  if (a === 270) return -90;
  return 0;
}

function turnFromEuler(gamma: number, beta: number, prev: Tilt): Tilt {
  const side = Math.abs(gamma);
  const upright = Math.abs(beta);
  const enter = prev === 0 ? 50 : 32;
  if (side > enter && upright < 72) return gamma > 0 ? 90 : -90;
  if (side < 28 || upright > 78) return 0;
  return prev;
}

function turnFromGravity(x: number, y: number, prev: Tilt): Tilt {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const enter = prev === 0 ? 4.2 : 2.8;
  if (ax > ay + 1.2 && ax > enter) return x > 0 ? 90 : -90;
  if (ay > ax + 1.2) return 0;
  return prev;
}

function setTurn(turn: Tilt) {
  if (snapshot.forced || snapshot.wide) return;
  if (snapshot.turn === turn) return;
  snapshot = { ...snapshot, turn, wide: false };
  emit();
}

function applyViewport() {
  const wide = viewportWide();
  if (wide) {
    if (snapshot.wide && snapshot.turn === 0 && !snapshot.forced) return;
    snapshot = { wide: true, turn: 0, forced: false, sensor: snapshot.sensor };
    emit();
    return;
  }
  const fromScreen = turnFromAngle(screenAngle());
  if (snapshot.forced) {
    if (snapshot.wide) {
      snapshot = { ...snapshot, wide: false };
      emit();
    }
    return;
  }
  if (fromScreen !== 0) {
    if (snapshot.turn === fromScreen && !snapshot.wide) return;
    snapshot = { ...snapshot, wide: false, turn: fromScreen };
    emit();
    return;
  }
  if (!snapshot.wide && snapshot.turn === 0) return;
  snapshot = { ...snapshot, wide: false, turn: sensorsBound ? snapshot.turn : 0 };
  emit();
}

function onDeviceOrientation(event: DeviceOrientationEvent) {
  if (viewportWide() || snapshot.forced) return;
  if (event.gamma == null || event.beta == null) return;
  setTurn(turnFromEuler(event.gamma, event.beta, snapshot.turn));
}

function onDeviceMotion(event: DeviceMotionEvent) {
  if (viewportWide() || snapshot.forced) return;
  const g = event.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null) return;
  setTurn(turnFromGravity(g.x, g.y, snapshot.turn));
}

function bindViewport() {
  if (started) return;
  started = true;
  applyViewport();
  window.addEventListener("resize", applyViewport);
  window.visualViewport?.addEventListener("resize", applyViewport);
  window.addEventListener("orientationchange", applyViewport);
  window.screen?.orientation?.addEventListener?.("change", applyViewport);
}

function bindSensors() {
  if (sensorsBound) return;
  sensorsBound = true;
  window.addEventListener("deviceorientation", onDeviceOrientation);
  window.addEventListener("deviceorientationabsolute", onDeviceOrientation);
  window.addEventListener("devicemotion", onDeviceMotion);
}

function permissionFns() {
  const orientation = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  const motion = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  const fns: Array<() => Promise<string>> = [];
  if (typeof orientation.requestPermission === "function") {
    fns.push(() => orientation.requestPermission!());
  }
  if (typeof motion.requestPermission === "function") {
    fns.push(() => motion.requestPermission!());
  }
  return fns;
}

/** Must be invoked from a tap/click. Starts requestPermission in this turn. */
export function enableTilt() {
  bindViewport();
  const fns = permissionFns();
  if (fns.length === 0) {
    bindSensors();
    if (snapshot.sensor !== "granted") {
      snapshot = { ...snapshot, sensor: "granted" };
      emit();
    }
    return Promise.resolve(true);
  }

  const pending = fns.map((fn) => {
    try {
      return fn();
    } catch {
      return Promise.resolve("denied");
    }
  });

  return Promise.all(pending)
    .then((results) => {
      const granted = results.some((status) => status === "granted");
      snapshot = { ...snapshot, sensor: granted ? "granted" : "denied" };
      if (granted) bindSensors();
      emit();
      return granted;
    })
    .catch(() => {
      snapshot = { ...snapshot, sensor: "denied" };
      emit();
      return false;
    });
}

function toggleSideways() {
  void enableTilt();
  if (viewportWide()) {
    snapshot = { wide: true, turn: 0, forced: false, sensor: snapshot.sensor };
    emit();
    return;
  }
  if (!snapshot.forced && snapshot.turn === 0) {
    snapshot = { ...snapshot, wide: false, turn: 90, forced: true };
  } else if (snapshot.forced && snapshot.turn === 90) {
    snapshot = { ...snapshot, wide: false, turn: -90, forced: true };
  } else {
    snapshot = { ...snapshot, wide: false, turn: 0, forced: false };
  }
  emit();
}

export function usePlayLayout() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const sideways = snap.wide || snap.turn !== 0;
  const onToggle = useCallback(() => toggleSideways(), []);
  return { ...snap, sideways, toggleSideways: onToggle };
}
