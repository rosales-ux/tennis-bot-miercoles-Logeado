const puppeteer = require("puppeteer");
const cron = require("node-cron");

const CONFIG = {
  url: "https://app.squarespacescheduling.com/schedule.php?owner=20292217",
  email: "rosalesjc@gmail.com",
  password: "Pepsico2019$",
  nombre: "julio",
  apellido: "rosales",
  telefono: "50045342",
  correo: "rosalesjc@gmail.com",
};

function getNextWednesday() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const diff = (3 - now.getDay() + 7) % 7 || 7;
  const wed = new Date(now);
  wed.setDate(now.getDate() + diff);
  const mm = String(wed.getMonth() + 1).padStart(2, "0");
  const dd = String(wed.getDate()).padStart(2, "0");
  return {
    day: wed.getDate(),
    display: `${dd}/${mm}/${wed.getFullYear()}`,
    shortDay: String(wed.getDate()),
  };
}

function log(msg) {
  const ts = new Date().toLocaleString("es-GT", { timeZone: "America/Guatemala" });
  console.log(`[${ts}] ${msg}`);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function msHasta6AM() {
  const ahoraGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const target = new Date(ahoraGT);
  target.setHours(6, 0, 0, 0);
  return target - ahoraGT;
}

async function navegarHastaMiercoles(page, wed) {
  for (let i = 0; i < 10; i++) {
    const diasVisibles = await page.evaluate(() => {
      const cols = document.querySelectorAll('[class*="css-13uwpu"]');
      return Array.from(cols).map(col => (col.innerText || "").toLowerCase().trim());
    });
    const encontrado = diasVisibles.some(d =>
      (d.includes("miércoles") || d.includes("mié")) && d.includes(wed.shortDay)
    );
    if (encontrado) return true;
    const avanzo = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Más horas"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!avanzo) return false;
    await delay(1000);
  }
  return false;
}

async function reservarCancha() {
  const wed = getNextWednesday();
  log(`🎾 Iniciando → TENNIS CANCHA 3 | Miércoles ${wed.display}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-first-run","--no-zygote","--single-process"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // ── FASE 1: Cargar página ─────────────────────────────────────
    log("📡 Cargando Acuity...");
    await page.goto(CONFIG.url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);

    // ── FASE 2: LOGIN ─────────────────────────────────────────────
    log("🔐 Iniciando sesión...");
    try {
      // Click en "Iniciar sesión"
      await page.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const btn of btns) {
          if ((btn.innerText || "").toLowerCase().includes("iniciar sesión") ||
              (btn.innerText || "").toLowerCase().includes("login") ||
              (btn.innerText || "").toLowerCase().includes("sign in")) {
            btn.click(); return;
          }
        }
      });
      await delay(2000);

      // Llenar correo
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="correo" i]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(CONFIG.email, { delay: 30 });
        log("✅ Email ingresado");
      }

      // Llenar contraseña
      const passInput = await page.$('input[type="password"], input[name="password"]');
      if (passInput) {
        await passInput.click({ clickCount: 3 });
        await passInput.type(CONFIG.password, { delay: 30 });
        log("✅ Contraseña ingresada");
      }

      // Click en submit de login
      await page.evaluate(() => {
        const btns = document.querySelectorAll("button, input[type='submit']");
        for (const btn of btns) {
          const txt = (btn.innerText || btn.value || "").toLowerCase();
          if (txt.includes("iniciar") || txt.includes("login") || txt.includes("sign in") || txt.includes("entrar") || txt.includes("ingresar")) {
            btn.click(); return;
          }
        }
        // Fallback: submit del form
        const form = document.querySelector("form");
        if (form) form.submit();
      });

      await delay(3000);
      log("✅ Login completado");
    } catch(e) {
      log(`⚠️ Login falló: ${e.message} — continuando sin login`);
    }

    // ── FASE 3: Seleccionar TENNIS CANCHA 3 ──────────────────────
    log("🎾 Seleccionando TENNIS CANCHA 3...");

    // Si hubo login puede haberse recargado la lista
    await page.waitForSelector("li.select-item", { timeout: 10000 }).catch(async () => {
      // Intentar navegar de nuevo a la página principal
      await page.goto(CONFIG.url, { waitUntil: "networkidle2", timeout: 20000 });
      await delay(2000);
    });

    const clickeado = await page.evaluate(() => {
      const items = document.querySelectorAll("li.select-item");
      for (const li of items) {
        if ((li.innerText || "").toUpperCase().includes("TENNIS CANCHA 3")) {
          const btn = li.querySelector("button");
          if (btn) { btn.click(); return true; }
          li.click(); return true;
        }
      }
      return false;
    });

    if (!clickeado) throw new Error("No se encontró TENNIS CANCHA 3");
    log("✅ TENNIS CANCHA 3 seleccionada");
    await delay(3000);

    // ── FASE 4: Navegar hasta el miércoles ───────────────────────
    const encontrado = await navegarHastaMiercoles(page, wed);
    log(encontrado
      ? `✅ Parado en miércoles ${wed.shortDay} — esperando las 6:00 AM`
      : `⚠️ No se encontró el miércoles, continuando igual`
    );

    // ── FASE 5: Esperar hasta las 6:00:00 AM exactas ─────────────
    const ms = msHasta6AM();
    if (ms > 0) {
      log(`⏳ Esperando ${Math.round(ms/1000)} segundos hasta las 6:00:00 AM...`);
      await delay(ms);
    }

    log("🚀 SON LAS 6:00 AM — CAPTURANDO SLOT");

    // ── FASE 6: POLLING cada 200ms hasta que aparezca un slot ─────
    let horaClickeada = null;
    const maxIntentos = 150; // 30 segundos máximo

    for (let i = 0; i < maxIntentos; i++) {
      // Refrescar vista
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Más horas"]');
        if (btn) btn.click();
      });
      await delay(100);
      await navegarHastaMiercoles(page, wed);

      horaClickeada = await page.evaluate(() => {
        const slots = document.querySelectorAll("button.time-selection");
        if (slots.length > 0) {
          const hora = (slots[0].innerText || "").trim();
          slots[0].click();
          return hora;
        }
        return null;
      });

      if (horaClickeada) {
        log(`⚡ SLOT CAPTURADO en intento ${i+1}: ${horaClickeada}`);
        break;
      }

      if (i % 10 === 0) log(`⏳ Intento ${i+1} — sin slots aún...`);
      await delay(200);
    }

    if (!horaClickeada) throw new Error("No aparecieron slots después de 30 segundos");
    await delay(1800);

    // ── FASE 7: Llenar datos (o confirmar si ya están pre-llenados) ──
    log("📝 Verificando datos del formulario...");
    await page.waitForSelector('input[name="firstName"]', { timeout: 6000 }).catch(() => {});

    const campos = [
      { selectors: ['input[name="firstName"]','input[id*="firstName"]','input[placeholder*="nombre" i]'], valor: CONFIG.nombre, label: "nombre" },
      { selectors: ['input[name="lastName"]','input[id*="lastName"]','input[placeholder*="apellido" i]'], valor: CONFIG.apellido, label: "apellido" },
      { selectors: ['input[name="phone"]','input[type="tel"]'], valor: CONFIG.telefono, label: "teléfono" },
      { selectors: ['input[name="email"]','input[type="email"]'], valor: CONFIG.correo, label: "correo" },
    ];

    for (const campo of campos) {
      for (const sel of campo.selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            // Solo llenar si está vacío
            const valorActual = await page.evaluate(e => e.value, el);
            if (!valorActual || valorActual.trim() === "") {
              await el.click({ clickCount: 3 });
              await el.type(campo.valor, { delay: 20 });
              log(`✅ ${campo.label}: ${campo.valor}`);
            } else {
              log(`✅ ${campo.label} ya pre-llenado: ${valorActual}`);
            }
            break;
          }
        } catch(e) {}
      }
    }

    await delay(400);

    // ── FASE 8: Confirmar ─────────────────────────────────────────
    log("🚀 Confirmando reserva...");
    await page.evaluate(() => {
      const btns = document.querySelectorAll("button");
      for (const btn of btns) {
        const txt = (btn.innerText || "").toLowerCase();
        if (txt.includes("confirm") || txt.includes("reserv") || txt.includes("agendar") || txt.includes("book")) {
          btn.click(); return;
        }
      }
    });

    await delay(5000);
    const textoFinal = await page.evaluate(() => document.body.innerText);
    const confirmado = ["confirmed","confirmad","booked","reservad","gracias","thank","cita confirmada"].some(k => textoFinal.toLowerCase().includes(k));

    if (confirmado) log(`🎉 ¡RESERVA CONFIRMADA! TENNIS CANCHA 3 — Miércoles ${wed.display}`);
    else log("📄 Estado: " + textoFinal.substring(0, 400));

    return confirmado;

  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

// Cron: Lunes 5:50 AM Guatemala = 11:50 UTC
log("🤖 Bot de Tennis Club La Villa iniciado");
log("⏰ Pre-carga: 5:50 AM | Disparo: 6:00:00 AM exactas");

cron.schedule("50 11 * * 1", async () => {
  log("⚡ CRON ACTIVADO — iniciando pre-carga");
  try { await reservarCancha(); } catch(e) { log(`❌ Falló: ${e.message}`); }
}, { timezone: "UTC" });

if (process.argv.includes("--now")) {
  log("🔧 Modo TEST");
  reservarCancha().then(() => log("✅ Finalizado")).catch(e => log(`❌ ${e.message}`));
}
