/* Agência Criativa Web — interações e cena 3D imersiva */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Tema (claro/escuro) ---------- */
  var THEME_KEY = "acw-theme";
  var onThemeChange = function () {};

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignora */ }
    onThemeChange();
  }

  var savedTheme = readTheme();
  if (savedTheme === "light" || savedTheme === "dark") {
    root.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.setAttribute("data-theme", "light");
  }

  document.querySelector(".theme-toggle").addEventListener("click", function () {
    applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  /* ---------- Menu mobile ---------- */
  var navToggle = document.querySelector(".nav__toggle");
  var navList = document.querySelector(".nav__list");

  function setMenu(open) {
    navToggle.classList.toggle("nav__toggle--open", open);
    navList.classList.toggle("nav__list--open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  }

  navToggle.addEventListener("click", function () {
    setMenu(!navList.classList.contains("nav__list--open"));
  });
  navList.addEventListener("click", function (e) {
    if (e.target.closest(".nav__link")) setMenu(false);
  });

  /* ---------- Revelar elementos ao rolar ---------- */
  var revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealItems.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 80 + "ms";
      io.observe(el);
    });
  } else {
    revealItems.forEach(function (el) { el.classList.add("reveal--visible"); });
  }

  /* ---------- Inclinação 3D dos cards ---------- */
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (px * 14).toFixed(2) + "deg");
        el.style.setProperty("--rx", (-py * 14).toFixed(2) + "deg");
      });
      el.addEventListener("mouseleave", function () {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Formulário (demonstração) ---------- */
  var form = document.querySelector(".form");
  var status = document.querySelector(".form__status");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = form.elements.nome.value.trim();
    var email = form.elements.email.value.trim();
    if (!nome || !/^\S+@\S+\.\S+$/.test(email)) {
      status.textContent = "Preencha nome e um e-mail válido.";
      return;
    }
    status.textContent = "Obrigado, " + nome + "! Entraremos em contato em breve.";
    form.reset();
  });

  /* ---------- Cena 3D (Three.js) ---------- */
  var canvas = document.querySelector(".scene");
  if (typeof THREE === "undefined") return; // sem WebGL/CDN: o site continua funcionando

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (err) {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 7;

  var colors = { primary: new THREE.Color(), accent: new THREE.Color() };
  function readColors() {
    var css = getComputedStyle(root);
    colors.primary.set(css.getPropertyValue("--primary").trim());
    colors.accent.set(css.getPropertyValue("--accent").trim());
  }
  readColors();

  /* Luzes */
  var lightA = new THREE.PointLight(colors.primary, 2.2, 30);
  var lightB = new THREE.PointLight(colors.accent, 2.2, 30);
  lightA.position.set(5, 4, 4);
  lightB.position.set(-5, -3, 3);
  scene.add(lightA, lightB, new THREE.AmbientLight(0xffffff, 0.35));

  /* Grupo principal: nó toroidal sólido + malha de arame + anéis */
  var hero = new THREE.Group();
  scene.add(hero);

  var knotGeo = new THREE.TorusKnotGeometry(1.25, 0.38, 180, 24, 2, 3);
  var knotMat = new THREE.MeshStandardMaterial({
    color: colors.primary, metalness: 0.75, roughness: 0.25, transparent: true, opacity: 0.9
  });
  var knot = new THREE.Mesh(knotGeo, knotMat);
  var wireMat = new THREE.MeshBasicMaterial({
    color: colors.accent, wireframe: true, transparent: true, opacity: 0.25
  });
  var wire = new THREE.Mesh(new THREE.TorusKnotGeometry(1.5, 0.5, 120, 16, 2, 3), wireMat);
  hero.add(knot, wire);

  var rings = [];
  for (var i = 0; i < 3; i++) {
    var ringMat = new THREE.MeshBasicMaterial({
      color: i % 2 ? colors.accent : colors.primary, transparent: true, opacity: 0.55
    });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.55, 0.012, 8, 160), ringMat);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    ring.userData.speed = 0.08 + i * 0.05;
    rings.push(ring);
    hero.add(ring);
  }

  /* Campo de partículas */
  var COUNT = window.innerWidth < 700 ? 700 : 1800;
  var pos = new Float32Array(COUNT * 3);
  for (var p = 0; p < COUNT; p++) {
    var r = 6 + Math.random() * 26;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    pos[p * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[p * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    pos[p * 3 + 2] = r * Math.cos(phi) - 6;
  }
  var starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var starMat = new THREE.PointsMaterial({
    color: colors.primary, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false
  });
  var stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* Troca de tema atualiza as cores da cena */
  onThemeChange = function () {
    readColors();
    lightA.color.copy(colors.primary);
    lightB.color.copy(colors.accent);
    knotMat.color.copy(colors.primary);
    wireMat.color.copy(colors.accent);
    starMat.color.copy(root.getAttribute("data-theme") === "light" ? colors.accent : colors.primary);
    rings.forEach(function (rg, idx) {
      rg.material.color.copy(idx % 2 ? colors.accent : colors.primary);
    });
  };
  onThemeChange();

  /* Entrada: mouse + rolagem */
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var scroll = { value: 0, target: 0 };

  window.addEventListener("pointermove", function (e) {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function updateScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    scroll.target = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", updateScroll, { passive: true });

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateScroll();
  }
  window.addEventListener("resize", resize);
  resize();

  /* Loop */
  var clock = new THREE.Clock();

  function frame() {
    var t = clock.getElapsedTime();
    var narrow = window.innerWidth < 820;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scroll.value += (scroll.target - scroll.value) * 0.06;
    var s = scroll.value;

    /* O objeto "viaja" pela página: zigue-zague lateral, aproxima e afasta */
    var side = narrow ? 0 : Math.sin(s * Math.PI * 3) * 3.2 + 2.2 * (1 - s);
    hero.position.x += (side - hero.position.x) * 0.08;
    hero.position.y = (narrow ? 1.6 - s * 2 : Math.sin(t * 0.6) * 0.15);
    hero.rotation.y = t * 0.25 + s * Math.PI * 4 + mouse.x * 0.6;
    hero.rotation.x = Math.sin(t * 0.3) * 0.2 + s * 2 + mouse.y * 0.4;
    var zoom = 1 + Math.sin(s * Math.PI) * 0.45;
    hero.scale.setScalar(narrow ? 0.7 * zoom : zoom);

    knot.rotation.z = t * 0.2;
    wire.rotation.z = -t * 0.12;
    rings.forEach(function (rg) {
      rg.rotation.z += rg.userData.speed * 0.01;
      rg.rotation.x += rg.userData.speed * 0.006;
    });

    /* Câmera atravessa as partículas */
    camera.position.x = mouse.x * 0.6;
    camera.position.y = -mouse.y * 0.4;
    camera.position.z = 7 - s * 3;
    camera.lookAt(0, 0, 0);
    stars.rotation.y = t * 0.02 + s * 1.2;
    stars.rotation.x = s * 0.5;

    lightA.position.x = 5 * Math.cos(t * 0.5);
    lightB.position.y = -3 * Math.sin(t * 0.4);

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (reduceMotion) {
    frame(); // um quadro estático
    window.addEventListener("resize", frame);
  } else {
    requestAnimationFrame(frame);
  }
})();
