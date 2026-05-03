import API from "./api-core.js";
import URLS from "./url.js";
import UI from "./uisystem.js";

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

  if (!file) {
    throw new Error("Fichier requis");
  }

  if (file.size > Upload.config.maxSize) {
    throw new Error("Fichier trop volumineux");
  }

  const isValidType = Upload.config.allowedTypes.some(type =>
    file.type.startsWith(type)
  );

  if (!isValidType) {
    throw new Error("Type de fichier non supporté");
  }
};

// =========================
// MAIN UPLOAD FLOW
// =========================
Upload.send = async (file, meta = {}) => {

  Upload.validate(file);

  return UI.api(async () => {

    // 1. demander URL sécurisée
    const { uploadUrl, fileUrl } = await API.post(
      URLS.api.media.uploadUrl,
      {
        type: file.type,
        size: file.size
      }
    );

    // 2. upload direct vers R2
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type
      }
    });

    if (!res.ok) {
      throw new Error("Échec upload stockage");
    }

    // 3. enregistrer en DB
    await API.post(URLS.api.media.base, {
      url: fileUrl,
      title: meta.title || file.name,
      type: file.type.startsWith("video") ? "video" : "image"
    });

    UI.toast("Upload réussi");

    return fileUrl;

  }, { loader: true });
};

// =========================
// BIND INPUT SIMPLE
// =========================
Upload.bindInput = (selector = "#uploadInput") => {

  const input = document.querySelector(selector);

  if (!input) return;

  input.addEventListener("change", async (e) => {

    const file = e.target.files[0];

    try {
      const url = await Upload.send(file);

      // option callback custom
      Upload.onSuccess?.(url);

    } catch (err) {
      UI.toast(err.message, "error");
    }

    input.value = ""; // reset
  });
};

// =========================
// DRAG & DROP (OPTION READY)
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

    const file = e.dataTransfer.files[0];

    try {
      const url = await Upload.send(file);
      Upload.onSuccess?.(url);
    } catch (err) {
      UI.toast(err.message, "error");
    }
  });
};

// =========================
// INIT GLOBAL (SAFE)
// =========================
Upload.init = () => {
  Upload.bindInput();
  Upload.bindDrop();
};

export default Upload;
