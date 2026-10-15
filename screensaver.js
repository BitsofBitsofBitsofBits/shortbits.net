"use strict";

const desktopScreensaver = document.querySelector("#desktop-screensaver");
const desktopScreensaverCanvas = document.querySelector("#desktop-screensaver-canvas");

if (!desktopScreensaver || !desktopScreensaverCanvas) {
  throw new Error("Desktop screensaver markup is missing.");
}

const screensaverContext = desktopScreensaverCanvas.getContext("2d");

if (!screensaverContext) {
  throw new Error("Desktop screensaver requires Canvas 2D support.");
}

let screensaverFrame = 0;
let screensaverLastTimestamp = 0;
let screensaverWidth = 0;
let screensaverHeight = 0;
let ribbons = [];
let mystifyShapes = [];

function createScreensaverPoint(speedMultiplier = 1) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (38 + Math.random() * 42) * speedMultiplier;
  return {
    x: Math.random() * screensaverWidth,
    y: Math.random() * screensaverHeight,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
  };
}

function createRibbon(index) {
  return {
    hue: (index * 117 + Math.random() * 60) % 360,
    points: Array.from({ length: 4 }, () => createScreensaverPoint(0.72)),
    trail: [],
  };
}

function createMystifyShape(index) {
  return {
    hue: (index * 163 + 54 + Math.random() * 45) % 360,
    points: Array.from({ length: 4 }, () => createScreensaverPoint(1.08)),
    trail: [],
  };
}

function resizeDesktopScreensaver() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  screensaverWidth = window.innerWidth;
  screensaverHeight = window.innerHeight;
  desktopScreensaverCanvas.width = Math.round(screensaverWidth * pixelRatio);
  desktopScreensaverCanvas.height = Math.round(screensaverHeight * pixelRatio);
  screensaverContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function moveScreensaverPoint(point, deltaSeconds) {
  point.x += point.velocityX * deltaSeconds;
  point.y += point.velocityY * deltaSeconds;

  if (point.x <= 0 || point.x >= screensaverWidth) {
    point.x = Math.max(0, Math.min(screensaverWidth, point.x));
    point.velocityX *= -1;
  }
  if (point.y <= 0 || point.y >= screensaverHeight) {
    point.y = Math.max(0, Math.min(screensaverHeight, point.y));
    point.velocityY *= -1;
  }
}

function rememberTrail(entity, maximumLength) {
  entity.trail.unshift(entity.points.map((point) => ({ x: point.x, y: point.y })));
  entity.trail.length = Math.min(entity.trail.length, maximumLength);
}

function drawRibbon(ribbon, elapsedSeconds) {
  for (let index = ribbon.trail.length - 1; index >= 0; index -= 1) {
    const points = ribbon.trail[index];
    const freshness = 1 - index / ribbon.trail.length;
    const hue = (ribbon.hue + elapsedSeconds * 9 + freshness * 34) % 360;
    screensaverContext.beginPath();
    screensaverContext.moveTo(points[0].x, points[0].y);
    screensaverContext.bezierCurveTo(
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
      points[3].x,
      points[3].y,
    );
    screensaverContext.lineCap = "round";
    screensaverContext.lineWidth = 1 + freshness * 8;
    screensaverContext.strokeStyle = `hsla(${hue}, 94%, 62%, ${0.018 + freshness * 0.16})`;
    screensaverContext.stroke();
  }

  const points = ribbon.trail[0];
  if (!points) {
    return;
  }
  screensaverContext.beginPath();
  screensaverContext.moveTo(points[0].x, points[0].y);
  screensaverContext.bezierCurveTo(
    points[1].x,
    points[1].y,
    points[2].x,
    points[2].y,
    points[3].x,
    points[3].y,
  );
  screensaverContext.lineWidth = 1.4;
  screensaverContext.strokeStyle = `hsla(${(ribbon.hue + elapsedSeconds * 9) % 360}, 100%, 84%, 0.8)`;
  screensaverContext.stroke();
}

function drawMystifyShape(shape, elapsedSeconds) {
  for (let index = shape.trail.length - 1; index >= 0; index -= 1) {
    const points = shape.trail[index];
    const freshness = 1 - index / shape.trail.length;
    const hue = (shape.hue - elapsedSeconds * 11 + index * 2.5) % 360;
    screensaverContext.beginPath();
    screensaverContext.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => screensaverContext.lineTo(point.x, point.y));
    screensaverContext.closePath();
    screensaverContext.lineJoin = "round";
    screensaverContext.lineWidth = 0.7 + freshness * 2.2;
    screensaverContext.strokeStyle = `hsla(${hue}, 100%, 68%, ${0.03 + freshness * 0.42})`;
    screensaverContext.stroke();
  }
}

function drawIdleLabel(elapsedSeconds) {
  const pulse = 0.2 + Math.sin(elapsedSeconds * 1.7) * 0.07;
  screensaverContext.font = "600 12px monospace";
  screensaverContext.textAlign = "right";
  screensaverContext.fillStyle = `rgba(190, 225, 255, ${pulse})`;
  screensaverContext.fillText("BITS OS // IDLE VISUALIZER", screensaverWidth - 24, screensaverHeight - 24);
}

function animateDesktopScreensaver(timestamp) {
  if (desktopScreensaver.hidden) {
    return;
  }

  const deltaSeconds = screensaverLastTimestamp
    ? Math.min((timestamp - screensaverLastTimestamp) / 1000, 0.05)
    : 0;
  const elapsedSeconds = timestamp / 1000;
  screensaverLastTimestamp = timestamp;
  screensaverContext.fillStyle = "#02030a";
  screensaverContext.fillRect(0, 0, screensaverWidth, screensaverHeight);

  ribbons.forEach((ribbon) => {
    ribbon.points.forEach((point) => moveScreensaverPoint(point, deltaSeconds));
    rememberTrail(ribbon, 34);
    drawRibbon(ribbon, elapsedSeconds);
  });

  mystifyShapes.forEach((shape) => {
    shape.points.forEach((point) => moveScreensaverPoint(point, deltaSeconds));
    rememberTrail(shape, 26);
    drawMystifyShape(shape, elapsedSeconds);
  });

  drawIdleLabel(elapsedSeconds);
  screensaverFrame = window.requestAnimationFrame(animateDesktopScreensaver);
}

function startDesktopScreensaver() {
  if (!desktopScreensaver.hidden) {
    return;
  }

  resizeDesktopScreensaver();
  ribbons = Array.from({ length: 3 }, (_, index) => createRibbon(index));
  mystifyShapes = Array.from({ length: 2 }, (_, index) => createMystifyShape(index));
  screensaverLastTimestamp = 0;
  desktopScreensaver.hidden = false;
  screensaverFrame = window.requestAnimationFrame(animateDesktopScreensaver);
}

function stopDesktopScreensaver() {
  window.cancelAnimationFrame(screensaverFrame);
  screensaverFrame = 0;
  screensaverLastTimestamp = 0;
  ribbons = [];
  mystifyShapes = [];
  desktopScreensaver.hidden = true;
  screensaverContext.clearRect(0, 0, screensaverWidth, screensaverHeight);
}

window.addEventListener("resize", () => {
  if (!desktopScreensaver.hidden) {
    resizeDesktopScreensaver();
  }
});

window.BitsDesktopScreensaver = Object.freeze({
  start: startDesktopScreensaver,
  stop: stopDesktopScreensaver,
});
