const BACKEND_URL = "http://192.168.1.193:5000/api/session"; // sostituisci con l'IP del tuo PC
const COOKIE_DOMAIN = "iperalspesaonline.it";

const btn = document.getElementById("syncBtn");
const status = document.getElementById("status");

function getAllCookies() {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain: COOKIE_DOMAIN }, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(cookies);
    });
  });
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  status.textContent = "Leggo i cookie...";

  try {
    const cookies = await getAllCookies();
    console.log("Cookie trovati:", cookies.map((c) => c.name));

    const jsessionid = cookies.find((c) => c.name === "JSESSIONID")?.value ?? null;
    const ebsnAccount = cookies.find((c) => c.name === "X-Ebsn-Account")?.value ?? null;

    if (!jsessionid || !ebsnAccount) {
      status.textContent =
        "Cookie non trovati. Assicurati di aver effettuato il login su iperalspesaonline.it in questo browser.";
      btn.disabled = false;
      return;
    }

    status.textContent = "Invio al backend...";

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsessionid, ebsnAccount }),
    });

    if (!res.ok) {
      throw new Error(`Backend ha risposto con errore (${res.status})`);
    }

    status.textContent = "✅ Sessione aggiornata!";
  } catch (err) {
    status.textContent = "❌ Errore: " + err.message;
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});
