(function () {
  var supabase = App.supabase,
    $ = App.$,
    toast = App.toast,
    copy = App.copy;

  function pollUrl(id) {
    return "https://votacion2.vercel.app/vote.html?poll=" + id;
  }

  async function createDefaults(poll_id) {
    // Inserta 3 jueces y 3 públicos automáticamente
    await supabase
      .from("poll_judges")
      .insert(["JUEZ1", "JUEZ2", "JUEZ3"].map((c) => ({ poll_id, code: c })));

    await supabase
      .from("poll_public")
      .insert(
        ["PUBLICO1", "PUBLICO2", "PUBLICO3"].map((c) => ({ poll_id, code: c }))
      );
  }

  $("#createPoll").onclick = async function () {
    var title = ($("#title").value || "").trim();
    if (!title) return toast("El título es obligatorio");

    // Crear encuesta en Supabase
    var ins = await supabase
      .from("polls")
      .insert([{ title, is_open: true }])
      .select()
      .single();

    if (ins.error) {
      console.error(ins.error);
      return toast("No se pudo crear", "bad");
    }

    var poll = ins.data;
    await createDefaults(poll.id);

    // Mostrar QR
    var qrBox = $("#qrBox");
    qrBox.innerHTML = "";
    new QRCode(qrBox, { text: pollUrl(poll.id), width: 240, height: 240 });

    $("#copyLink").onclick = function () {
      copy(pollUrl(poll.id));
      toast("Link copiado");
    };

    $("#resultsLink").href = "results.html?poll=" + poll.id;

    toast("Encuesta creada ✅");
    loadPolls();
  };

  async function loadPolls() {
    var tb = $("#rows");
    tb.innerHTML = "<tr><td colspan='4' class='small'>Cargando…</td></tr>";

    var q = await supabase
      .from("polls")
      .select("*")
      .order("created_at", { ascending: false });

    if (q.error) {
      tb.innerHTML = "<tr><td colspan='4'>Error</td></tr>";
      return;
    }

    var data = q.data || [];
    if (!data.length) {
      tb.innerHTML =
        "<tr><td colspan='4' class='small'>No hay encuestas</td></tr>";
      return;
    }

    tb.innerHTML = data
      .map(function (p) {
        var open = p.is_open !== false;
        return (
          "<tr>" +
          "<td>" +
          p.title +
          "</td>" +
          "<td>" +
          (open
            ? "<span class='tag ok'>Abierta</span>"
            : "<span class='tag bad'>Cerrada</span>") +
          "</td>" +
          "<td>" +
          (p.created_at ? new Date(p.created_at).toLocaleString() : "-") +
          "</td>" +
          "<td>" +
          "<button class='secondary' data-act='vote' data-id='" +
          p.id +
          "'>Votar</button>" +
          "<button class='secondary' data-act='results' data-id='" +
          p.id +
          "'>Resultados</button>" +
          "<button class='warning' data-act='toggle' data-id='" +
          p.id +
          "'>" +
          (open ? "Cerrar" : "Abrir") +
          "</button>" +
          "<button class='danger' data-act='delete' data-id='" +
          p.id +
          "'>Eliminar</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  document.addEventListener("click", async function (e) {
    var b = e.target.closest("button[data-act]");
    if (!b) return;

    var id = b.getAttribute("data-id"),
      act = b.getAttribute("data-act");

    if (act === "vote") location.href = "vote.html?poll=" + id;
    if (act === "results") location.href = "results.html?poll=" + id;

    if (act === "toggle") {
      var g = await supabase
        .from("polls")
        .select("is_open")
        .eq("id", id)
        .single();

      if (g.error) return toast("Error leyendo estado", "bad");

      var u = await supabase
        .from("polls")
        .update({ is_open: !(g.data.is_open !== false) })
        .eq("id", id);

      if (u.error) toast("No se pudo actualizar", "bad");
      else {
        toast("Estado cambiado");
        loadPolls();
      }
    }

    if (act === "delete") {
      if (!confirm("¿Eliminar encuesta y sus votos?")) return;

      await supabase.from("votes").delete().eq("poll_id", id);
      await supabase.from("poll_judges").delete().eq("poll_id", id);
      await supabase.from("poll_public").delete().eq("poll_id", id);

      var d = await supabase.from("polls").delete().eq("id", id);
      if (d.error) toast("No se pudo eliminar", "bad");
      else {
        toast("Eliminada");
        loadPolls();
      }
    }
  });

  loadPolls();
})();
