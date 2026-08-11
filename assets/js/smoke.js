/* ==========================================================================
   CAVARO — pointer influence for the hero smoke
   --------------------------------------------------------------------------
   The plumes rise, drift, expand and fade entirely in CSS. This file only
   adds a gentle air current: the pointer pushes nearby layers away from the
   cursor through eased --sx / --sy offsets. No cursor following, no jitter,
   no canvas, no particles. Everything returns to the natural motion on its
   own once the pointer settles.
   ========================================================================== */
(function () {
	"use strict";

	var root = document.querySelector("[data-smoke]");
	if (!root) return;

	var reduce =
		window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
	if (reduce && reduce.matches) return;

	var hero = root.parentElement || root;
	var nodes = Array.prototype.slice.call(
		root.querySelectorAll(".cavaro-smoke__layer")
	);
	if (!nodes.length) return;

	/* Each layer answers the air current a little differently. */
	var TUNING = [
		{ max: 30, ease: 0.05, lift: 0.6 },
		{ max: 42, ease: 0.038, lift: 0.5 },
		{ max: 26, ease: 0.045, lift: 0.7 },
		{ max: 22, ease: 0.055, lift: 0.55 },
		{ max: 18, ease: 0.032, lift: 0.45 }
	];

	var layers = nodes.map(function (el, i) {
		var t = TUNING[i % TUNING.length];
		return {
			el: el,
			max: t.max,
			ease: t.ease,
			lift: t.lift,
			ax: 0.5,
			ay: 0.5,
			x: 0,
			y: 0,
			tx: 0,
			ty: 0,
			sx: 0,
			sy: 0
		};
	});

	/* --- geometry ---------------------------------------------------------- */
	var box = { left: 0, top: 0, width: 1, height: 1 };
	var measureQueued = false;

	function measure() {
		measureQueued = false;
		var b = hero.getBoundingClientRect();
		if (!b.width || !b.height) return;
		box = { left: b.left, top: b.top, width: b.width, height: b.height };
		layers.forEach(function (l) {
			var r = l.el.getBoundingClientRect();
			/* Anchor a little above the base of the plume: that is where the
			   visible body of smoke sits. */
			l.ax = (r.left + r.width / 2 - b.left) / b.width;
			l.ay = (r.top + r.height * 0.62 - b.top) / b.height;
		});
	}

	function queueMeasure() {
		if (measureQueued) return;
		measureQueued = true;
		requestAnimationFrame(measure);
	}

	/* --- pointer ----------------------------------------------------------- */
	var px = 0.5;
	var py = 0.5;
	var hasPointer = false;
	var boost = 0;
	var lastMove = 0;
	var lastX = 0;
	var lastY = 0;
	var lastT = 0;
	var strength = 1;

	function pointer(clientX, clientY, weight) {
		if (!box.width || !box.height) return;
		var now = performance.now();
		var nx = (clientX - box.left) / box.width;
		var ny = (clientY - box.top) / box.height;

		if (lastT) {
			var dt = Math.max(now - lastT, 16);
			var travel = Math.hypot(clientX - lastX, clientY - lastY);
			var speed = travel / dt; /* px per ms */
			/* Quick movement disturbs the air a little more — never violently. */
			boost = Math.min(1, boost * 0.72 + Math.min(speed / 1.7, 1) * 0.5);
		}

		lastX = clientX;
		lastY = clientY;
		lastT = now;
		lastMove = now;
		px = nx;
		py = ny;
		strength = weight;
		hasPointer = true;
		start();
	}

	function onMouseMove(e) {
		pointer(e.clientX, e.clientY, 1);
	}

	function onTouchMove(e) {
		var t = e.touches && e.touches[0];
		if (t) pointer(t.clientX, t.clientY, 0.45);
	}

	function onLeave() {
		hasPointer = false;
	}

	/* --- loop -------------------------------------------------------------- */
	var running = false;
	var visible = true;
	var frame = 0;

	function step() {
		frame = 0;
		var idleFor = performance.now() - lastMove;
		var settled = true;

		/* Air keeps moving briefly after the cursor stops, then lets go. */
		if (!hasPointer || idleFor > 110) boost *= 0.965;
		var decay = !hasPointer || idleFor > 140 ? Math.pow(0.94, 1) : 1;

		for (var i = 0; i < layers.length; i++) {
			var l = layers[i];

			if (hasPointer) {
				var dx = l.ax - px;
				var dy = l.ay - py;
				var dist = Math.hypot(dx, dy);
				var near = Math.max(0, 1 - dist / 0.55);
				near = near * near * (3 - 2 * near); /* smoothstep falloff */
				var amount =
					near * l.max * strength * (0.55 + 0.65 * boost);
				var norm = dist < 0.0001 ? 0 : 1 / dist;
				l.tx = dx * norm * amount;
				l.ty = dy * norm * amount * l.lift;
			} else {
				l.tx = 0;
				l.ty = 0;
			}

			l.tx *= decay;
			l.ty *= decay;

			l.x += (l.tx - l.x) * l.ease;
			l.y += (l.ty - l.y) * l.ease;

			if (Math.abs(l.x - l.sx) > 0.05 || Math.abs(l.y - l.sy) > 0.05) {
				l.sx = l.x;
				l.sy = l.y;
				l.el.style.setProperty("--sx", l.x.toFixed(2) + "px");
				l.el.style.setProperty("--sy", l.y.toFixed(2) + "px");
			}

			if (Math.abs(l.x) > 0.08 || Math.abs(l.tx) > 0.08 || Math.abs(l.y) > 0.08)
				settled = false;
		}

		if (settled && (!hasPointer || idleFor > 900)) {
			running = false;
			return;
		}
		frame = requestAnimationFrame(step);
		running = true;
	}

	function start() {
		if (running || !visible) return;
		running = true;
		frame = requestAnimationFrame(step);
	}

	function stop() {
		running = false;
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
	}

	/* --- wiring ------------------------------------------------------------ */
	measure();
	window.addEventListener("resize", queueMeasure);
	window.addEventListener("scroll", queueMeasure, { passive: true });
	window.addEventListener("mousemove", onMouseMove, { passive: true });
	window.addEventListener("touchmove", onTouchMove, { passive: true });
	document.addEventListener("mouseleave", onLeave);
	window.addEventListener("touchend", onLeave, { passive: true });
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
	window.addEventListener("load", measure);

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) stop();
	});

	if ("IntersectionObserver" in window) {
		new IntersectionObserver(
			function (entries) {
				visible = entries[0].isIntersecting;
				if (!visible) {
					stop();
					hasPointer = false;
				} else {
					queueMeasure();
				}
			},
			{ threshold: 0 }
		).observe(hero);
	}
})();
