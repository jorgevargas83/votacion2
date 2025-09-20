(function () {
  if (!window.supabase) {
    console.error("Load UMD Supabase first");
    return;
  }
  var client = window.supabase.createClient(
    "https://lkptbwzakvokkyhhjynt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcHRid3pha3Zva2t5aGhqeW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDYxODgsImV4cCI6MjA3MzkyMjE4OH0.9Rt63hiiXe6demqubd1vwfUfCyRpyjRC7kEZIdMRTj0"
  );

  function qs(n, d) {
    var v = new URLSearchParams(location.search).get(n);
    return v == null ? d : v;
  }
  function $(s, r) {
    return (r || document).querySelector(s);
  }
  function fmt(n) {
    return Number(n == null ? 0 : n).toFixed(2);
  }
  function toast(m) {
    var el = document.createElement("div");
    el.textContent = m;
    el.style.cssText =
      "position:fixed;left:50%;top:20px;transform:translateX(-50%);background:#111821;color:#fff;border:1px solid #2a3a4f;padding:8px 12px;border-radius:10px;z-index:9999;opacity:0;transition:.2s";
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = 1;
    });
    setTimeout(function () {
      el.style.opacity = 0;
      setTimeout(function () {
        el.remove();
      }, 200);
    }, 2200);
  }
  function copy(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t);
  }
  window.App = {
    supabase: client,
    qs: qs,
    $: $,
    fmt: fmt,
    toast: toast,
    copy: copy,
  };
})();
