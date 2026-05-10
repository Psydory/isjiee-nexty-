// =========================
// IMPORTS
// =========================
import API from "./api-core.js";
import URLS from "./url.js";
import UI from "./uisystem.js";

// =========================
// MODULE
// =========================
const Upload = {};

// =========================
// CONFIG
// =========================
Upload.config = {
  maxSize: 15 * 1024 * 1024, // 15MB
  allowedTypes: ["image/", "video/"]
};

// =========================
// VALIDATION
// =========================
Upload.validate = (file) => {

  if (!file) throw new Error("Fichier requis");

  if (file.size > Upload.config.maxSize) {
    throw new Error("Fichier trop volumineux");
  }

  const valid = Upload.config.allowedTypes.some(type =>
    file.type.startsWith(type)
  );

  if (!valid) throw new Error("Type non supporté");
};

// =========================
// UPLOAD FLOW
// =========================
Upload.send = async (file, meta = {}) => {

  Upload.validate(file);

  Upload.onStart?.(file);

  try {

    return await UI.api(async () => {

      // 1. DEMANDE URL SIGNÉE
      const res = await API.post(URLS.api.media.uploadUrl, {
        type: file.type,
        size: file.size
      });

      const uploadUrl = res.uploadUrl;
      const fileUrl = res.fileUrl;

      if (!uploadUrl || !fileUrl) {
        throw new Error("Upload URL invalide");
      }

      // 2. UPLOAD DIRECT (R2 / STORAGE)
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error("Échec upload stockage");
      }

      // 3. SAVE EN DB (ROUTE CORRECTE)
      await API.post(URLS.api.media.validate, {
        url: fileUrl,
        title: meta.title || file.name,
        type: file.type.startsWith("video") ? "video" : "image"
      });

      Upload.onSuccess?.(fileUrl);

      UI.toast("Upload réussi", "success");

      return fileUrl;

    }, { loader: true });

  } catch (err) {

    Upload.onError?.(err);

    UI.toast(err.message || "Erreur upload", "error");

    throw err;
  }
};

// =========================
// INPUT FILE
// =========================
Upload.bindInput = (selector = "#fileInput") => {

  const input = document.querySelector(selector);
  if (!input) return;

  input.addEventListener("change", async (e) => {

    const files = Array.from(e.target.files);

    for (const file of files) {
      try {
        await Upload.send(file);
      } catch {}
    }

    input.value = ""; // reset
  });
};

// =========================
// DRAG & DROP
// =========================
Upload.bindDrop = (selector = "#uploadZone") => {

  const zone = document.querySelector(selector);
  if (!zone) return;

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragging");
  });

  zone.addEventListener("drop", async (e) => {

    e.preventDefault();
    zone.classList.remove("dragging");

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      try {
        await Upload.send(file);
      } catch {}
    }
  });
};

// =========================
// INIT GLOBAL
// =========================
Upload.init = () => {
  Upload.bindInput();
  Upload.bindDrop();
};

// =========================
// CALLBACKS (OPTIONNELS)
// =========================
Upload.onStart = null;
Upload.onSuccess = null;
Upload.onError = null;

// =========================
// EXPORT
// =========================
export default Upload;
