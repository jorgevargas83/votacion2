// admin.js
// =====================
// Panel de administración 3×3 (QR optimizado para Android)
// Requiere: qrcodejs UMD, supabase-js UMD y app.global.js cargados antes
// =====================

"use strict";

/* ===== Clientes y utilidades desde app.global.js ===== */
const App   = window.App || {};
const sb    = App.supabase || null;                 // ← cliente Supabase creado en app.global.js
const toast = App.toast || ((m) => alert(m));
const copy  = App.copy  || (t => navigator.clipboard?.writeText(t));
const $     = App.$     || ((s, r=document) => r.querySelector(s));

/* ===== Selectores de UI ===== */
const titleInput  = $("#title");
const createBtn   = $("#createPoll");
const rowsBody    = $("#rows");
const qrBox       = $("#qrBox");
const copyBtn     = $("#copyLink");
const resultsLink = $("#resultsLink");

/* ===== Estado ===== */
const ROLES = ["JUEZ1","JUEZ2","JUEZ3","PUBLICO1","PUBLICO2","PUBLICO3"];
let currentPoll = null;         // { id, title, is_open, created_at }
let currentRole = "PUBLICO1";

/* ===== Helpers ===== */
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
function tagHtml(text, cls = "") {
  const base = cls ? `tag ${cls}` : "tag";
  return `<span class="${base}">${text}</span>`;
}

/* ==========================================================
   QR Android-friendly: sin escalado CSS, quiet zone y ECC H
   ========================================================== */
function renderQRInBox(url) {
  if (!qrBox) return;
  qrBox.innerHTML = ""; // limpia “QR aquí”

  // Tamaño final recomendado para Android (CSS ya lo refuerza)
  const SIZE = 336;

  // Contenedor donde qrcodejs inyecta canvas/img
  const qrContainer = document.createElement("div");
  qrBox.appendChild(qrContainer);

  // Generar QR con alto contraste y ECC alta
  new QRCode(qrContainer, {
    text: url,
    width: SIZE,
    height: SIZE,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Bloquear tamaño visual = intrínseco y forzar nitidez
  setTimeout(() => {
    const node = qrContainer.querySelector("canvas, img");
    if (!node) return;
    node.style.width = SIZE + "px";
    node.style.height = SIZE + "px";
    node.style.imageRendering = "pixelated";
    if (node.tagName === "CANVAS") {
      node.width = SIZE;
      node.height = SIZE;
    }
  }, 0);
}

// Construye URL de voto (ajusta el nombre si tu archivo difiere)
function buildVoteUrl(pollId, role) {
  const page = "vote.html"; // p. ej. "votar.html" si ese es tu archivo
  return `${location.origin}/${page}?poll=${encodeURIComponent(pollId)}&role=${encodeURIComponent(role)}`;
}

function updateLinks(poll) {
  if (!poll) return;
  const voteUrl = buildVoteUrl(poll.id, currentRole);
  renderQRInBox(voteUrl);

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await copy(voteUrl);
        const prev = copyBtn.textContent;
        copyBtn.textContent = "¡Copiado!";
        setTimeout(() => (copyBtn.textContent = prev), 1400);
      } catch {
        toast("No se pudo copiar el link");
      }
    };
  }
  if (resultsLink) {
    resultsLink.href = `${location.origin}/results.html?poll=${encodeURIComponent(poll.id)}`;
  }
}

/* ===== Barra de roles debajo del QR ===== */
const roleBar = document.createElement("div");
roleBar.className = "flex";
roleBar.style.marginTop = "10px";
roleBar.id = "roleBar";
qrBox?.parentElement?.appendChild(roleBar);

function renderRoleBar() {
  roleBar.innerHTML = "";
  ROLES.forEach((r) => {
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = r;
    if (r === currentRole) btn.style.outline = "2px solid var(--acc)";
    btn.onclick = () => {
      currentRole = r;
      if (currentPoll) updateLinks(currentPoll);
      renderRoleBar();
    };
    roleBar.appendChild(btn);
  });
}

/* ===== CRUD de encuestas ===== */
async function loadPolls() {
  if (!sb) {
    rowsBody.innerHTML = `<tr><td colspan="4" class="small">Configura Supabase en app.global.js</td></tr>`;
    return;
  }

  const { data, error } = await sb
    .from("polls")                         // ← ajusta si tu tabla se llama distinto
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadPolls error:", error);
    rowsBody.innerHTML = `<tr><td colspan="4" class="small">Error al cargar</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    rowsBody.innerHTML = `<tr><td colspan="4" class="small">Sin encuestas aún</td></tr>`;
    currentPoll = null;
    qrBox.innerHTML = "QR aquí";
    return;
  }

  rowsBody.innerHTML = data.map((p) => {
    const state = p.is_open ? tagHtml("Abierta", "ok") : tagHtml("Cerrada", "bad");
    return `
      <tr data-id="${p.id}">
        <td>${p.title || "—"}</td>
        <td>${state}</td>
        <td class="small">${fmtDate(p.created_at)}</td>
        <td class="flex">
          <button class="secondary btn-qr">QR</button>
          <button class="warning btn-toggle">${p.is_open ? "Cerrar" : "Abrir"}</button>
          <button class="danger btn-del">Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");

  // Acciones fila
  rowsBody.querySelectorAll(".btn-qr").forEach((btn) => {
    btn.onclick = (e) => {
      const tr = e.target.closest("tr");
      const id = tr?.getAttribute("data-id");
      const poll = data.find((x) => x.id === id);
      if (!poll) return;
      currentPoll = poll;
      updateLinks(poll);
    };
  });

  rowsBody.querySelectorAll(".btn-toggle").forEach((btn) => {
    btn.onclick = async (e) => {
      const tr = e.target.closest("tr");
      const id = tr?.getAttribute("data-id");
      const poll = data.find((x) => x.id === id);
      if (!poll) return;

      const { error } = await sb
        .from("polls")
        .update({ is_open: !poll.is_open })
        .eq("id", poll.id);

      if (error) {
        toast("No se pudo actualizar el estado");
        console.error(error);
        return;
      }
      await loadPolls();
      if (currentPoll?.id === poll.id) {
        currentPoll.is_open = !poll.is_open;
        updateLinks(currentPoll);
      }
    };
  });

  rowsBody.querySelectorAll(".btn-del").forEach((btn) => {
    btn.onclick = async (e) => {
      const tr = e.target.closest("tr");
      const id = tr?.getAttribute("data-id");
      const poll = data.find((x) => x.id === id);
      if (!poll) return;

      if (!confirm("¿Eliminar esta encuesta? Esta acción no se puede deshacer.")) return;

      // Si tienes tabla de votos relacionada, podrías borrar primero:
      // await sb.from("votes").delete().eq("poll_id", poll.id);

      const { error } = await sb.from("polls").delete().eq("id", poll.id);
      if (error) {
        toast("No se pudo eliminar");
        console.error(error);
        return;
      }
      if (currentPoll?.id === poll.id) {
        currentPoll = null;
        qrBox.innerHTML = "QR aquí";
      }
      await loadPolls();
    };
  });

  // Si no hay selección aún, usa la primera
  if (!currentPoll) {
    currentPoll = data[0];
    updateLinks(currentPoll);
  }
}

async function createPoll() {
  if (!sb) return toast("Configura Supabase en app.global.js");
  const title = (titleInput?.value || "").trim() || "Encuesta";
  createBtn.disabled = true;

  const { data, error } = await sb
    .from("polls")                         // ← ajusta si tu tabla se llama distinto
    .insert([{ title, is_open: true }])
    .select("*")
    .single();

  createBtn.disabled = false;

  if (error) {
    toast("No se pudo crear la encuesta");
    console.error(error);
    return;
  }

  if (titleInput) titleInput.value = "";
  await loadPolls();
  currentPoll = data;
  updateLinks(currentPoll);
}

/* ===== Wire-up ===== */
if (createBtn) createBtn.addEventListener("click", createPoll);
renderRoleBar();
loadPolls();

/* ===== (Opcional) Realtime en polls =====
   Requiere habilitar Realtime para la tabla en Supabase
*/
// if (sb?.channel) {
//   const ch = sb
//     .channel("polls-changes")
//     .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, loadPolls)
//     .subscribe();
//   window.addEventListener("beforeunload", () => { try { sb.removeChannel(ch); } catch {} });
// }
