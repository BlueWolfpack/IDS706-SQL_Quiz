(function () {
  "use strict";

  const cfg = window.QUIZ_CONFIG;
  const questions = window.QUIZ_QUESTIONS;
  const tables = window.QUIZ_TABLES;
  const MAX_ROWS = 1000; // run_quiz_sql returns at most 1001 rows; we show 1000 and flag the rest

  const $ = (id) => document.getElementById(id);
  const el = {
    loading: $("loading"),
    authView: $("authView"),
    quizView: $("quizView"),
    userBox: $("userBox"),
    userEmail: $("userEmail"),
    signOutBtn: $("signOutBtn"),
    tabSignIn: $("tabSignIn"),
    tabSignUp: $("tabSignUp"),
    authTitle: $("authTitle"),
    authForm: $("authForm"),
    authEmail: $("authEmail"),
    authPassword: $("authPassword"),
    authSubmit: $("authSubmit"),
    authMsg: $("authMsg"),
    qList: $("qList"),
    totalPoints: $("totalPoints"),
    qEyebrow: $("qEyebrow"),
    qTitle: $("qTitle"),
    qBadge: $("qBadge"),
    qPoints: $("qPoints"),
    qSkills: $("qSkills"),
    qPrompt: $("qPrompt"),
    schemaList: $("schemaList"),
    editor: $("sqlEditor"),
    runBtn: $("runBtn"),
    clearBtn: $("clearBtn"),
    resultStatus: $("resultStatus"),
    resultTable: $("resultTable"),
    hintBox: $("hintBox"),
    hintList: $("hintList"),
    answerBox: $("answerBox"),
    answerSql: $("answerSql"),
    answerTable: $("answerTable"),
    answerNote: $("answerNote"),
    useAnswerBtn: $("useAnswerBtn"),
  };

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  // ---------- small storage helpers (per-browser convenience only) ----------
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ } },
  };

  // ---------- state ----------
  let mode = "signin";
  let current = 0;
  let saveTimer = null;
  const lastResult = {}; // question id -> {status, cls, rows, columns}

  // ---------- auth view ----------
  function setMode(next) {
    mode = next;
    const signIn = mode === "signin";
    el.tabSignIn.classList.toggle("active", signIn);
    el.tabSignUp.classList.toggle("active", !signIn);
    el.tabSignIn.setAttribute("aria-selected", String(signIn));
    el.tabSignUp.setAttribute("aria-selected", String(!signIn));
    el.authTitle.textContent = signIn ? "Sign in to take the quiz" : "Create an account";
    el.authSubmit.textContent = signIn ? "Sign in" : "Create account";
    el.authPassword.autocomplete = signIn ? "current-password" : "new-password";
    showAuthMsg("");
  }

  function showAuthMsg(text, kind) {
    el.authMsg.textContent = text;
    el.authMsg.className = "msg" + (kind ? " " + kind : "");
  }

  async function handleAuth(evt) {
    evt.preventDefault();
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;
    if (!email || !password) { showAuthMsg("Enter your email and password.", "error"); return; }
    if (password.length < 6) { showAuthMsg("Password must be at least 6 characters.", "error"); return; }

    el.authSubmit.disabled = true;
    try {
      if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw error;
        if (!data.session) {
          showAuthMsg("Account created. Check your email for a confirmation link, then sign in.", "ok");
          setModeKeepMsg("signin");
        }
      }
    } catch (err) {
      showAuthMsg(err.message || String(err), "error");
    } finally {
      el.authSubmit.disabled = false;
    }
  }

  function setModeKeepMsg(next) {
    const text = el.authMsg.textContent, cls = el.authMsg.className;
    setMode(next);
    el.authMsg.textContent = text;
    el.authMsg.className = cls;
  }

  function render(session) {
    el.loading.hidden = true;
    const signedIn = !!session;
    el.authView.hidden = signedIn;
    el.quizView.hidden = !signedIn;
    el.userBox.hidden = !signedIn;
    el.userEmail.textContent = signedIn ? session.user.email : "";
    if (signedIn) showQuestion(current);
  }

  // ---------- quiz navigation ----------
  function buildNav() {
    el.qList.innerHTML = "";
    questions.forEach((q, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.index = String(i);
      const num = document.createElement("span");
      num.className = "qnum";
      num.textContent = q.points ? String(i + 1) : "★";
      const name = document.createElement("span");
      name.className = "qname";
      name.textContent = q.title;
      const pts = document.createElement("span");
      pts.className = "qpts";
      pts.textContent = q.points ? q.points + " pts" : "bonus";
      btn.append(num, name, pts);
      btn.addEventListener("click", () => showQuestion(i));
      li.appendChild(btn);
      el.qList.appendChild(li);
    });
    el.totalPoints.textContent = String(questions.reduce((s, q) => s + q.points, 0));
  }

  function buildSchema() {
    el.schemaList.innerHTML = "";
    tables.forEach((t) => {
      const div = document.createElement("div");
      div.className = "schema-item";
      const name = document.createElement("code");
      name.textContent = t.name;
      const cols = document.createElement("div");
      cols.className = "cols";
      cols.textContent = t.columns;
      const note = document.createElement("div");
      note.className = "muted";
      note.textContent = t.note;
      div.append(name, cols, note);
      el.schemaList.appendChild(div);
    });
  }

  function showQuestion(i) {
    saveEditor();
    current = i;
    store.set("quiz:current", String(i));
    const q = questions[i];

    [...el.qList.querySelectorAll("button")].forEach((b, j) => {
      b.classList.toggle("active", j === i);
      if (j === i) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });

    el.qEyebrow.textContent = q.points ? "Question " + (i + 1) : "Bonus";
    el.qTitle.textContent = q.title;
    el.qPoints.textContent = q.points ? q.points + " points" : "0 points";
    el.qBadge.hidden = !q.badge;
    el.qBadge.textContent = q.badge || "";
    el.qSkills.textContent = q.skills || "";
    el.qPrompt.innerHTML = q.prompt; // trusted, authored content from questions.js

    el.editor.value = store.get("quiz:sql:" + q.id) || "";

    el.hintBox.open = false;
    el.hintList.innerHTML = (q.hints || []).map((h) => "<li>" + h + "</li>").join(""); // trusted, authored content
    el.answerBox.open = false;
    el.answerSql.textContent = q.sql;
    renderTable(el.answerTable, q.expected.columns, q.expected.rows.map((r) => toObj(q.expected.columns, r)));
    el.answerNote.hidden = !q.note;
    el.answerNote.textContent = q.note ? "Note: " + q.note : "";

    const prev = lastResult[q.id];
    if (prev) {
      setStatus(prev.status, prev.cls);
      renderTable(el.resultTable, prev.columns, prev.rows);
    } else {
      setStatus("Run a query to see the result table here.", "");
      el.resultTable.innerHTML = "";
    }
  }

  function toObj(cols, row) {
    const o = {};
    cols.forEach((c, k) => { o[c] = row[k]; });
    return o;
  }

  // ---------- editor ----------
  function saveEditor() {
    const q = questions[current];
    if (q) store.set("quiz:sql:" + q.id, el.editor.value);
  }

  el.editor.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveEditor, 400);
  });

  el.editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const s = el.editor.selectionStart, end = el.editor.selectionEnd;
      el.editor.setRangeText("  ", s, end, "end");
      saveEditor();
    }
  });

  el.clearBtn.addEventListener("click", () => {
    el.editor.value = "";
    saveEditor();
    el.editor.focus();
  });

  el.useAnswerBtn.addEventListener("click", () => {
    el.editor.value = questions[current].sql;
    saveEditor();
    el.editor.focus();
    el.editor.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- running SQL ----------
  function setStatus(text, cls) {
    el.resultStatus.textContent = text;
    el.resultStatus.className = "status" + (cls ? " " + cls : "");
  }

  async function runQuery() {
    const sql = el.editor.value;
    const q = questions[current];
    if (!sql.trim()) { setStatus("Write a query first.", "error"); el.resultTable.innerHTML = ""; return; }

    el.runBtn.disabled = true;
    setStatus("Running…", "");
    const started = performance.now();
    try {
      const { data, error } = await client.rpc("run_quiz_sql", { query: sql });
      if (error) throw error;
      const ms = Math.round(performance.now() - started);
      let rows = Array.isArray(data) ? data : [];
      const truncated = rows.length > MAX_ROWS;
      if (truncated) rows = rows.slice(0, MAX_ROWS);
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const status = truncated
        ? `Showing the first ${MAX_ROWS} rows (the query returned more). ${ms} ms`
        : `${rows.length} row${rows.length === 1 ? "" : "s"} · ${ms} ms`;
      lastResult[q.id] = { status, cls: "ok", rows, columns };
      setStatus(status, "ok");
      renderTable(el.resultTable, columns, rows);
    } catch (err) {
      const msg = friendlyError(err);
      lastResult[q.id] = { status: msg, cls: "error", rows: [], columns: [] };
      setStatus(msg, "error");
      el.resultTable.innerHTML = "";
    } finally {
      el.runBtn.disabled = false;
    }
  }

  function friendlyError(err) {
    const m = (err && (err.message || err.details)) || String(err);
    if (/statement timeout|canceling statement/i.test(m)) return "Error: the query took too long (8 second limit).";
    if (/JWT|not authenticated|permission denied for function/i.test(m)) return "Error: your session expired. Sign out and sign in again.";
    return "Error: " + m;
  }

  el.runBtn.addEventListener("click", runQuery);

  // ---------- table rendering ----------
  function renderTable(container, columns, rows) {
    container.innerHTML = "";
    if (!columns.length) return;
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    columns.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      columns.forEach((c) => {
        const td = document.createElement("td");
        const v = r[c];
        if (v === null || v === undefined) {
          td.textContent = "NULL";
          td.className = "null";
        } else if (typeof v === "number") {
          td.textContent = String(v);
          td.className = "num";
        } else if (typeof v === "object") {
          td.textContent = JSON.stringify(v);
        } else {
          td.textContent = String(v);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    container.appendChild(table);
  }

  // ---------- wire up ----------
  el.tabSignIn.addEventListener("click", () => setMode("signin"));
  el.tabSignUp.addEventListener("click", () => setMode("signup"));
  el.authForm.addEventListener("submit", handleAuth);
  el.signOutBtn.addEventListener("click", async () => {
    saveEditor();
    await client.auth.signOut();
  });

  buildNav();
  buildSchema();
  const saved = parseInt(store.get("quiz:current") || "0", 10);
  current = Number.isInteger(saved) && saved >= 0 && saved < questions.length ? saved : 0;

  client.auth.onAuthStateChange((_event, session) => render(session));
  client.auth.getSession().then(({ data }) => render(data.session));
})();
