// ═══════════════════════════════════════════════
//  FlashLearn Studio — script.js
//  Pure browser, no Node.js, no build step.
// ═══════════════════════════════════════════════

const API_BASE         = "https://gen.pollinations.ai";
const STORAGE_KEY_DOCS = "flashlearn_docs_v1";
const STORAGE_KEY_API  = "flashlearn_api_key";
const STORAGE_KEY_NL   = "flashlearn_newsletter_done";
const EMAILJS_SERVICE_ID = "service_62v1xjs";
const EMAILJS_PUBLIC_KEY = "JF-jcuIQR58xzQ4-0";
const EMAILJS_TEMPLATE_ID = "template_issnglw";

// ─── State ────────────────────────────────────
let API_KEY    = "";
let docs       = [];
let activeCards = [];
let currentIndex = 0;
let parsing    = false;
let audioReady = false;
let audioDocId = null;
let audioObjectUrl = null;

const speedSteps = [0.75, 1, 1.25, 1.5, 2];
let speedIndex = 2; // 1.25x default

// ─── DOM ──────────────────────────────────────
const onboardOverlay    = document.getElementById("onboardOverlay");
const newsletterOverlay = document.getElementById("newsletterOverlay");
const mainApp           = document.getElementById("mainApp");
const btnGetKey         = document.getElementById("btnGetKey");
const btnSaveKey        = document.getElementById("btnSaveKey");
const keyInput          = document.getElementById("keyInput");
const keyError          = document.getElementById("keyError");
const keyStatusPill     = document.getElementById("keyStatusPill");
const btnAlreadySubscribed  = document.getElementById("btnAlreadySubscribed");
const nlForm               = document.getElementById("nlForm");
const nlName               = document.getElementById("nlName");
const nlEmail              = document.getElementById("nlEmail");
const nlError              = document.getElementById("nlError");
const nlSubmit             = document.getElementById("nlSubmit");
const nlSuccess            = document.getElementById("nlSuccess");

const dropZone        = document.getElementById("dropZone");
const fileInput       = document.getElementById("fileInput");
const chipsTitle      = document.getElementById("chipsTitle");
const chipsStatus     = document.getElementById("chipsStatus");
const chipsStatusText = document.getElementById("chipsStatusText");
const parsedList      = document.getElementById("parsedList");

const cardStack       = document.getElementById("cardStack");
const cardPlaceholder = document.getElementById("cardPlaceholder");
const deckCounter     = document.getElementById("deckCounter");
const labelTrue       = document.getElementById("labelTrue");
const labelFalse      = document.getElementById("labelFalse");
const feedbackBar     = document.getElementById("feedbackBar");
const fbText          = document.getElementById("fbText");
const fbIconCorrect   = document.getElementById("fbIconCorrect");
const fbIconWrong     = document.getElementById("fbIconWrong");

const btnPlay    = document.getElementById("btnPlay");
const playerLabel = document.getElementById("playerLabel");
const progress   = document.getElementById("progress");
const progFill   = document.getElementById("progFill");
const btnDownload = document.getElementById("btnDownload");
const speedLabel = document.getElementById("speedLabel");
const audioPlayer = document.getElementById("audioPlayer");

// ═══════════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════════

function showLeadCapture() {
  keyError.style.display = "none";
  onboardOverlay.style.display    = "none";
  newsletterOverlay.style.display = "";
  mainApp.style.display           = "none";
  nlError.textContent             = "";
  nlSuccess.classList.add("hidden");
  nlForm.classList.remove("hidden");
}

function goToApp() {
  onboardOverlay.style.display    = "none";
  newsletterOverlay.style.display = "none";
  mainApp.style.display           = "";
  loadDocsFromStorage();
  lucide.createIcons();
}

function launchApp(apiKey) {
  API_KEY = apiKey;
  localStorage.setItem(STORAGE_KEY_API, apiKey);
  goToApp();
}

function showOnboarding() {
  onboardOverlay.style.display    = "";
  newsletterOverlay.style.display = "none";
  mainApp.style.display           = "none";
  keyInput.focus();
}

btnGetKey.addEventListener("click", () => {
  const redirect = encodeURIComponent(location.href.split("#")[0]);
  location.href  = `https://enter.pollinations.ai/authorize?redirect_url=${redirect}&permissions=profile,balance&expiry=30`;
});

btnSaveKey.addEventListener("click", () => {
  const val = keyInput.value.trim();
  if (!val) { showKeyError("Please paste your API key."); return; }
  if (!val.startsWith("sk_") && !val.startsWith("pk_")) {
    showKeyError("Key should start with sk_ or pk_. Check enter.pollinations.ai");
    return;
  }
  validateAndLaunch(val);
});

keyInput.addEventListener("keydown", e => { if (e.key === "Enter") btnSaveKey.click(); });
keyStatusPill.addEventListener("click", () => {
  // Disconnect key and restart from first screen
  localStorage.removeItem(STORAGE_KEY_API);
  localStorage.removeItem(STORAGE_KEY_NL);
  API_KEY = "";
  showLeadCapture();
});

btnAlreadySubscribed.addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY_NL, "1");
  showOnboarding();
});

function showKeyError(msg) {
  keyError.textContent   = msg;
  keyError.style.display = "block";
}

function showNewsletterError(msg) {
  nlError.textContent = msg;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function initEmailJS() {
  if (!window.emailjs) throw new Error("Email service failed to load. Check internet and try again.");
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

async function submitNewsletterLead(name, email) {
  if (!EMAILJS_TEMPLATE_ID) {
    throw new Error("Email template is not configured.");
  }
  const templateParams = {
    // Submitter identity for EmailJS template vars.
    from_name: name,
    from_email: email,
    user: name,
    user_email: email,
    name,
    email,
    reply_to: email,
    subject: `New FlashLearn signup: ${name}`,
    app_name: "FlashLearn",
    message: `Hey! ${name} with email ${email} just subscribed!`,
  };

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

function getEmailJsErrorMessage(err) {
  const details = err?.text || err?.message || "";
  if (details) return `Email service error: ${details}`;
  if (err?.status) return `Email service error (${err.status}).`;
  return "Couldn't submit right now. Please try again.";
}

function setSubmitButtonLoading(isLoading) {
  nlSubmit.disabled = isLoading;
  if (isLoading) {
    nlSubmit.textContent = "Starting...";
  } else {
    nlSubmit.innerHTML = `<i data-lucide="send"></i>Start FlashLearn`;
    lucide.createIcons();
  }
}

async function onNewsletterSubmit(e) {
  e.preventDefault();
  const name = nlName.value.trim();
  const email = nlEmail.value.trim();
  showNewsletterError("");

  if (!name) {
    showNewsletterError("Please enter your name.");
    nlName.focus();
    return;
  }
  if (!isValidEmail(email)) {
    showNewsletterError("Please enter a valid email address.");
    nlEmail.focus();
    return;
  }

  setSubmitButtonLoading(true);
  try {
    initEmailJS();
    await submitNewsletterLead(name, email);
    localStorage.setItem(STORAGE_KEY_NL, "1");
    nlForm.classList.add("hidden");
    nlSuccess.classList.remove("hidden");
    lucide.createIcons();
    setTimeout(showOnboarding, 900);
  } catch (err) {
    console.error("EmailJS submit failed:", err);
    showNewsletterError(getEmailJsErrorMessage(err));
  } finally {
    setSubmitButtonLoading(false);
  }
}

async function validateAndLaunch(key) {
  btnSaveKey.textContent = "Checking...";
  btnSaveKey.disabled    = true;
  keyError.style.display = "none";
  try {
    const res = await fetch(`${API_BASE}/account/key`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (res.status === 401) {
      showKeyError("Key not recognised. Check enter.pollinations.ai");
      return;
    }
    launchApp(key);
  } catch {
    launchApp(key);
  } finally {
    btnSaveKey.textContent = "Use key";
    btnSaveKey.disabled    = false;
  }
}

function checkHashForKey() {
  const params = new URLSearchParams(location.hash.slice(1));
  const key    = params.get("api_key");
  if (key) {
    history.replaceState(null, "", location.pathname + location.search);
    launchApp(key);
    return true;
  }
  return false;
}

function init() {
  lucide.createIcons();
  if (checkHashForKey()) return;
  const saved = localStorage.getItem(STORAGE_KEY_API);
  if (saved) {
    API_KEY = saved;
    goToApp();
    return;
  }
  // Always start from the first lead-capture screen when no API key is saved.
  showLeadCapture();
}

// ═══════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════

function saveDocsToStorage() {
  const toSave = docs.map(d => ({
    id: d.id, name: d.name, summary: d.summary,
    audioScript: d.audioScript,
    cards: d.cards, equipped: d.equipped, savedAt: d.savedAt || Date.now(),
  }));
  try { localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(toSave)); }
  catch (e) { console.warn("localStorage full:", e); }
}

function loadDocsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.length) return;
    docs = saved;
    renderParsedDocs();
    rebuildCardStack();
    setStatus({ title: "DOCUMENTS", text: `${docs.length} doc${docs.length > 1 ? "s" : ""} restored`, active: false });
  } catch (e) { console.warn("Restore failed:", e); }
}

// ═══════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

// ═══════════════════════════════════════════════
//  STATUS
// ═══════════════════════════════════════════════

function setStatus({ title, text, active }) {
  chipsTitle.textContent      = title || "DOCUMENTS";
  chipsStatusText.textContent = text  || "Idle";
  chipsStatus.classList.toggle("is-active", Boolean(active));
}

function setUiBusy(busy) {
  parsing            = busy;
  fileInput.disabled = busy;
}

// ═══════════════════════════════════════════════
//  CARD STACK
// ═══════════════════════════════════════════════

function rebuildCardStack() {
  cardStack.querySelectorAll(".flash-card").forEach(el => el.remove());

  const equipped = getEquippedDocs();
  activeCards  = equipped.flatMap(d => d.cards.map(c => ({ ...c, source: d.name, docId: d.id })));
  currentIndex = 0;

  if (!activeCards.length) {
    cardPlaceholder.style.display = "";
    deckCounter.textContent       = "";
    hideFeedback();
    return;
  }

  cardPlaceholder.style.display = "none";
  updateCounter();

  const topN = Math.min(3, activeCards.length);
  for (let i = topN - 1; i >= 0; i--) renderCard(i);

  lucide.createIcons();
}

function renderCard(depthOffset) {
  const idx  = (currentIndex + depthOffset) % activeCards.length;
  const card = activeCards[idx];
  const el   = document.createElement("div");

  el.className   = "flash-card";
  el.dataset.idx = idx;
  el.style.setProperty("--depth", depthOffset);
  el.classList.toggle("is-top", depthOffset === 0);
  el.classList.toggle("is-mid", depthOffset === 1);
  el.classList.toggle("is-bot", depthOffset === 2);

  el.innerHTML = `
    <div class="fc-statement">${escHtml(card.statement)}</div>
    <div class="fc-footer">
      <span class="fc-source">${escHtml(card.source)}</span>
      <span class="fc-badge">True / False?</span>
    </div>
  `;

  cardStack.appendChild(el);
  return el;
}

function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function updateCounter() {
  deckCounter.textContent = activeCards.length
    ? `${currentIndex + 1} / ${activeCards.length}`
    : "";
}

// ═══════════════════════════════════════════════
//  SWIPE — direction: RIGHT = True, LEFT = False
// ═══════════════════════════════════════════════

function bindCardSwipe() {
  let startX = 0, startY = 0, dragging = false, topCard = null;

  const getTop = () => cardStack.querySelector(".flash-card.is-top");

  const onStart = e => {
    topCard = getTop();
    if (!topCard || parsing) return;
    dragging = true;
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX; startY = pt.clientY;
    topCard.style.transition = "none";
    hideFeedback();
  };

  const onMove = e => {
    if (!dragging || !topCard) return;
    const pt  = e.touches ? e.touches[0] : e;
    const dx  = pt.clientX - startX;
    const dy  = pt.clientY - startY;
    const rot = dx / 14;
    topCard.style.transform = `translateX(${dx}px) translateY(${dy * 0.25}px) rotate(${rot}deg)`;
    topCard.style.opacity   = `${1 - Math.min(Math.abs(dx) / 400, 0.3)}`;

    // Dragging RIGHT → TRUE shows on RIGHT, LEFT → FALSE shows on LEFT
    const pct = Math.abs(dx) / 120;
    if (dx > 30) {
      labelTrue.style.opacity  = Math.min(pct, 1);
      labelFalse.style.opacity = 0;
    } else if (dx < -30) {
      labelFalse.style.opacity = Math.min(pct, 1);
      labelTrue.style.opacity  = 0;
    } else {
      labelTrue.style.opacity = labelFalse.style.opacity = 0;
    }
  };

  const onEnd = e => {
    if (!dragging || !topCard) return;
    dragging = false;
    labelTrue.style.opacity = labelFalse.style.opacity = 0;

    const pt = e.changedTouches ? e.changedTouches[0] : e;
    const dx = pt.clientX - startX;

    if (dx > 100) {
      // swiped RIGHT → True
      flyOut(topCard, true, () => gradeAndAdvance(true));
    } else if (dx < -100) {
      // swiped LEFT → False
      flyOut(topCard, false, () => gradeAndAdvance(false));
    } else {
      topCard.style.transition = "transform 0.35s cubic-bezier(.25,.46,.45,.94), opacity 0.2s";
      topCard.style.transform  = "";
      topCard.style.opacity    = "";
    }
  };

  cardStack.addEventListener("mousedown",  onStart);
  window.addEventListener("mousemove",     onMove);
  window.addEventListener("mouseup",       onEnd);
  cardStack.addEventListener("touchstart", onStart, { passive: true });
  cardStack.addEventListener("touchmove",  onMove,  { passive: true });
  cardStack.addEventListener("touchend",   onEnd);
}

function flyOut(el, toRight, cb) {
  const dir = toRight ? 1 : -1;
  el.style.transition = "transform 0.38s cubic-bezier(.55,0,.7,.4), opacity 0.3s";
  el.style.transform  = `translateX(${dir * 120}vw) rotate(${dir * 22}deg)`;
  el.style.opacity    = "0";
  el.addEventListener("transitionend", () => { el.remove(); cb(); }, { once: true });
}

function gradeAndAdvance(userSaysTrue) {
  if (!activeCards.length) return;
  const card    = activeCards[currentIndex];
  const correct = userSaysTrue === card.isTrue;

  showFeedback(correct, card);

  currentIndex = (currentIndex + 1) % activeCards.length;
  updateCounter();

  // Promote remaining cards up one depth level
  cardStack.querySelectorAll(".flash-card").forEach(c => {
    const d = parseInt(c.style.getPropertyValue("--depth")) - 1;
    c.style.setProperty("--depth", d);
    c.classList.toggle("is-top", d === 0);
    c.classList.toggle("is-mid", d === 1);
    c.classList.toggle("is-bot", d === 2);
    if (d === 0) {
      c.style.transition = "transform 0.3s cubic-bezier(.34,1.56,.64,1)";
      c.style.transform  = "";
      c.style.opacity    = "";
    }
  });

  // Append a new card at the back if we have enough
  if (activeCards.length >= 3) {
    const newIdx  = (currentIndex + 2) % activeCards.length;
    const newCard = activeCards[newIdx];
    const el      = document.createElement("div");
    el.className  = "flash-card is-bot";
    el.style.setProperty("--depth", 2);
    el.dataset.idx = newIdx;
    el.style.opacity = "0";
    el.innerHTML = `
      <div class="fc-statement">${escHtml(newCard.statement)}</div>
      <div class="fc-footer">
        <span class="fc-source">${escHtml(newCard.source)}</span>
        <span class="fc-badge">True / False?</span>
      </div>
    `;
    cardStack.insertBefore(el, cardStack.firstChild);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; }));
  }
}

// ═══════════════════════════════════════════════
//  FEEDBACK BAR
// ═══════════════════════════════════════════════

let feedbackTimer = null;

function showFeedback(correct, card) {
  feedbackBar.className = `feedback-bar ${correct ? "fb-good" : "fb-bad"}`;
  fbIconCorrect.style.display = correct ? ""   : "none";
  fbIconWrong.style.display   = correct ? "none" : "";
  fbText.textContent = correct
    ? "Correct!"
    : `Wrong — the answer is ${card.isTrue ? "True" : "False"}. ${card.explanation || ""}`;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(hideFeedback, 2800);
}

function hideFeedback() {
  feedbackBar.className = "feedback-bar hidden";
}

// ═══════════════════════════════════════════════
//  DOCS
// ═══════════════════════════════════════════════

function getEquippedDocs() { return docs.filter(d => d.equipped); }

function renderParsedDocs() {
  parsedList.innerHTML = "";
  if (!docs.length) {
    const e = document.createElement("div");
    e.className = "chip-empty"; e.textContent = "No documents yet.";
    parsedList.appendChild(e);
    return;
  }

  docs.forEach(doc => {
    const row = document.createElement("div");
    row.className = "doc-chip";

    const meta = document.createElement("div");
    meta.className = "doc-meta";
    const name = document.createElement("div");
    name.className = "doc-name"; name.textContent = doc.name;
    const sub = document.createElement("div");
    sub.className = "doc-sub"; sub.textContent = `${doc.cards.length} cards`;
    meta.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    const equip = document.createElement("button");
    equip.className   = `equip-btn${doc.equipped ? " is-on" : ""}`;
    equip.textContent = doc.equipped ? "Unequip" : "Equip";
    equip.addEventListener("click", () => {
      doc.equipped = !doc.equipped;
      saveDocsToStorage();
      renderParsedDocs();
      rebuildCardStack();
      setStatus({ title: "DOCUMENTS", text: `${getEquippedDocs().length} equipped`, active: false });
    });

    const del = document.createElement("button");
    del.className = "del-btn";
    del.setAttribute("aria-label", "Remove");
    del.innerHTML = `<i data-lucide="x"></i>`;
    del.addEventListener("click", () => {
      docs = docs.filter(d => d.id !== doc.id);
      saveDocsToStorage();
      renderParsedDocs();
      rebuildCardStack();
      lucide.createIcons();
    });

    actions.append(equip, del);
    row.append(meta, actions);
    parsedList.appendChild(row);
  });

  lucide.createIcons();
}

// ═══════════════════════════════════════════════
//  FILE PARSING
// ═══════════════════════════════════════════════

async function readFileAsText(file) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return extractPdfText(file);
  if (/\.docx$/i.test(file.name)) return extractDocxText(file);
  return file.text();
}

async function extractPdfText(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("PDF.js not loaded.");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map(it => it.str || "").join(" "));
  }
  return pages.join("\n\n");
}

async function extractDocxText(file) {
  if (typeof mammoth === "undefined") throw new Error("Mammoth.js not loaded.");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value || "";
}

// ═══════════════════════════════════════════════
//  AI — GENERATE CARDS
// ═══════════════════════════════════════════════

function safeJsonParse(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```json\s*/i,"").replace(/^```/,"").replace(/```$/,"").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

async function generateCards(sourceText) {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: "gemini-flash-lite-3.1",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are a study assistant. From the source text, create:\n" +
            "1. 12 true/false flashcards\n" +
            "2. An engaging audio lesson script (2-3 mins spoken) that teaches the key ideas in a clear, inspiring, conversational way — like a brilliant friend explaining it to you, not reading bullet points.\n\n" +
            'Return ONLY valid JSON: {"summary":"one sentence","audioScript":"full spoken lesson script","cards":[{"statement":"string max 120 chars","isTrue":boolean,"explanation":"string max 80 chars"}]}. ' +
            "No markdown, no code fences, no line breaks inside string values.",
        },
        { role: "user", content: `Source material:\n\n${sourceText.slice(0, 16000)}` },
      ],
    }),
  });

  if (res.status === 401) { localStorage.removeItem(STORAGE_KEY_API); showOnboarding(); throw new Error("API key expired."); }
  if (res.status === 402) throw new Error("Pollinations balance empty. Top up at enter.pollinations.ai");
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const data   = await res.json();
  const parsed = safeJsonParse(data?.choices?.[0]?.message?.content);
  if (!parsed || !Array.isArray(parsed.cards)) throw new Error("Model returned invalid JSON.");

  const cards = parsed.cards
    .filter(c => typeof c?.statement === "string" && typeof c?.isTrue === "boolean")
    .map(c => ({
      statement:   trunc(clean(c.statement), 120),
      isTrue:      c.isTrue,
      explanation: trunc(clean(c.explanation || ""), 80),
    }));

  if (!cards.length) throw new Error("No valid cards generated.");
  return { summary: parsed.summary || "", audioScript: parsed.audioScript || "", cards };
}

const clean = v => String(v || "").replace(/\s+/g," ").trim();
const trunc = (v, max) => !v ? "" : v.length <= max ? v : `${v.slice(0,max-1).trimEnd()}…`;

// ═══════════════════════════════════════════════
//  FILE HANDLING
// ═══════════════════════════════════════════════

async function handleFiles(files) {
  const list = Array.from(files);
  if (!list.length) return;
  setUiBusy(true);

  for (const file of list) {
    try {
      setStatus({ title: "READING", text: file.name, active: true });
      const text = await readFileAsText(file);
      setStatus({ title: "GENERATING CARDS", text: file.name, active: true });
      const generated = await generateCards(text);

      const doc = {
        id:          `${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
        name:        file.name,
        summary:     generated.summary,
        audioScript: generated.audioScript,
        cards:       generated.cards,
        equipped:    getEquippedDocs().length === 0,
        savedAt:     Date.now(),
      };

      docs.unshift(doc);
      saveDocsToStorage();
      renderParsedDocs();
      rebuildCardStack();

      audioReady = false;
      audioDocId = null;
      playerLabel.textContent = `Audio lesson ready — press play`;
      progFill.style.width    = "0%";

      setStatus({ title: "DOCUMENTS", text: `Done — ${file.name}`, active: false });
    } catch (err) {
      console.error(err);
      setStatus({ title: "FAILED", text: err?.message || "Unknown error", active: false });
    }
  }

  setUiBusy(false);
}

// ═══════════════════════════════════════════════
//  FILE INPUT — fix double-open
// ═══════════════════════════════════════════════

function bindFileInput() {
  dropZone.addEventListener("click", e => {
    if (e.target === fileInput) return;
    fileInput.click();
  });
  dropZone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("is-dragging"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("is-dragging");
    handleFiles(e.dataTransfer?.files || []);
  });
  fileInput.addEventListener("change", e => {
    handleFiles(e.target.files || []);
    fileInput.value = "";
  });
}

// ═══════════════════════════════════════════════
//  AUDIO — Pollinations ElevenLabs TTS model
// ═══════════════════════════════════════════════

async function generateAudio(script) {
  const spokenText = script.slice(0, 5000);
  const url = `${API_BASE}/audio/${encodeURIComponent(spokenText)}?model=elevenlabs`;
  const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    let details = "";
    try {
      const errJson = await res.json();
      details = errJson?.error?.message || errJson?.message || "";
    } catch {
      details = "";
    }
    throw new Error(details || `Audio error ${res.status}`);
  }

  const audioBlob = await res.blob();
  if (!audioBlob || !audioBlob.size) throw new Error("No audio data returned.");
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = URL.createObjectURL(audioBlob);
  audioPlayer.src = audioObjectUrl;
  audioReady = true;
}

function bindAudioControls() {
  btnPlay.addEventListener("click", async () => {
    const equipped = getEquippedDocs();
    if (!equipped.length) {
      playerLabel.textContent = "Equip a document first";
      return;
    }

    const doc = equipped[0];

    try {
      if (!audioReady || audioDocId !== doc.id) {
        setPlayIcon("loader");
        playerLabel.textContent = "Generating audio lesson...";
        const script = doc.audioScript ||
          `Let me teach you about: ${doc.name}. ${doc.summary}. ` +
          doc.cards.slice(0, 8).map(c => `${c.statement} — this is ${c.isTrue ? "true" : "false"}. ${c.explanation}`).join(" ");
        await generateAudio(script);
        audioDocId = doc.id;
        playerLabel.textContent = doc.name;
      }

      if (audioPlayer.paused) {
        await audioPlayer.play();
      } else {
        audioPlayer.pause();
      }
    } catch (err) {
      console.error(err);
      setPlayIcon("play");
      playerLabel.textContent = `Audio failed: ${err.message}`;
    }
  });

  // Scrub
  let scrubbing = false;
  const scrubTo = e => {
    if (!audioPlayer.duration) return;
    const r = progress.getBoundingClientRect();
    audioPlayer.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audioPlayer.duration;
  };
  progress.addEventListener("mousedown", e => { scrubbing = true; scrubTo(e); });
  window.addEventListener("mousemove",   e => { if (scrubbing) scrubTo(e); });
  window.addEventListener("mouseup",     () => { scrubbing = false; });
  progress.addEventListener("click", scrubTo);

  // Speed
  speedLabel.addEventListener("click", () => {
    speedIndex = (speedIndex + 1) % speedSteps.length;
    audioPlayer.playbackRate = speedSteps[speedIndex];
    speedLabel.textContent   = `${speedSteps[speedIndex]}x`;
  });

  btnDownload.addEventListener("click", async () => {
    const equipped = getEquippedDocs();
    if (!equipped.length) {
      playerLabel.textContent = "Equip a document first";
      return;
    }
    const doc = equipped[0];

    try {
      if (!audioReady || audioDocId !== doc.id) {
        setPlayIcon("loader");
        playerLabel.textContent = "Generating audio lesson...";
        const script = doc.audioScript ||
          `Let me teach you about: ${doc.name}. ${doc.summary}. ` +
          doc.cards.slice(0, 8).map(c => `${c.statement} — this is ${c.isTrue ? "true" : "false"}. ${c.explanation}`).join(" ");
        await generateAudio(script);
        audioDocId = doc.id;
      }

      const safeDocName = (doc.name || "flashlearn-audio")
        .replace(/\.[^.]+$/, "")
        .replace(/[^\w\-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "flashlearn-audio";
      const downloadUrl = audioObjectUrl || audioPlayer.src;
      if (!downloadUrl) throw new Error("No audio available yet.");
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${safeDocName}-lesson.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      playerLabel.textContent = "Audio downloaded";
      setPlayIcon(audioPlayer.paused ? "play" : "pause");
    } catch (err) {
      console.error(err);
      playerLabel.textContent = `Download failed: ${err.message}`;
      setPlayIcon("play");
    }
  });

  audioPlayer.addEventListener("timeupdate", () => {
    if (!audioPlayer.duration) return;
    progFill.style.width = `${Math.min(1, audioPlayer.currentTime / audioPlayer.duration) * 100}%`;
  });

  audioPlayer.addEventListener("play",  () => setPlayIcon("pause"));
  audioPlayer.addEventListener("pause", () => setPlayIcon("play"));
  audioPlayer.addEventListener("ended", () => { setPlayIcon("play"); progFill.style.width = "0%"; });
}

function setPlayIcon(name) {
  btnPlay.innerHTML = `<i data-lucide="${name}" id="playIcon"></i>`;
  lucide.createIcons();
}

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════

bindFileInput();
bindCardSwipe();
bindAudioControls();
nlForm.addEventListener("submit", onNewsletterSubmit);
renderParsedDocs();
init();
