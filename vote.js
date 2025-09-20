(function () {
  var supabase = App.supabase,
    qs = App.qs,
    $ = App.$,
    fmt = App.fmt,
    toast = App.toast;

  var pollId = qs("poll");
  var role = null,
    userCode = null,
    pollObj = null;

  function setStateTag(o) {
    var t = $("#stateTag");
    t.textContent = o ? "Abierta" : "Cerrada";
    t.className = "tag " + (o ? "ok" : "bad");
    $("#check").disabled = !o;
  }

  function localKey(c) {
    return "voted_" + pollId + ":" + c;
  }

  $("#score").addEventListener("input", function (e) {
    var v = parseFloat(e.target.value || 0);
    $("#scoreValue").textContent = fmt(v);
    $("#scoreBar").style.width = (v / 10) * 100 + "%";
  });

  async function loadPoll() {
    var r = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (r.error || !r.data) {
      toast("Encuesta no encontrada", "bad");
      return false;
    }
    pollObj = r.data;
    $("#pTitle").textContent = pollObj.title;
    setStateTag(pollObj.is_open !== false);
    return true;
  }

  $("#check").onclick = async function () {
    var c = ($("#code").value || "").trim();
    if (!c) return toast("Ingresa tu código");
    if (pollObj && pollObj.is_open === false)
      return toast("Encuesta cerrada", "warn");

    // Verificar si es juez
    var j = await supabase
      .from("poll_judges")
      .select("code")
      .eq("poll_id", pollId)
      .eq("code", c)
      .maybeSingle();

    if (j.error) {
      console.error(j.error);
      return toast(j.error.message || "Error verificando", "bad");
    }
    if (j.data) {
      role = "judge";
      userCode = c;
    }

    // Si no es juez, verificar si es público
    if (!role) {
      var p = await supabase
        .from("poll_public")
        .select("code")
        .eq("poll_id", pollId)
        .eq("code", c)
        .maybeSingle();

      if (p.error) {
        console.error(p.error);
        return toast(p.error.message || "Error verificando", "bad");
      }
      if (p.data) {
        role = "public";
        userCode = c;
      }
    }

    if (!role) return toast("Código no válido para esta encuesta", "bad");

    // Verificar si ya votó en la base de datos
    var ex = await supabase
      .from("votes")
      .select("poll_id")
      .eq("poll_id", pollId)
      .eq("user_code", userCode)
      .maybeSingle();

    if (ex.data) return toast("Este código ya votó", "warn");

    // Verificar si ya votó en este dispositivo
    if (localStorage.getItem(localKey(userCode)))
      return toast("Ya votaste desde este dispositivo", "warn");

    $("#roleInfo").innerHTML =
      "Votarás como <span class='tag " +
      (role === "judge" ? "warn" : "") +
      "'>" +
      (role === "judge" ? "JUEZ" : "PÚBLICO") +
      "</span>";
    $("#voteArea").style.display = "block";
  };

  $("#submitVote").onclick = async function () {
    var v = parseFloat($("#score").value);
    if (isNaN(v)) return toast("Selecciona un puntaje", "warn");
    if (pollObj && pollObj.is_open === false)
      return toast("Encuesta cerrada", "warn");

    $("#submitVote").disabled = true;
    try {
      var ins = await supabase.from("votes").insert([
        { poll_id: pollId, user_code: userCode, score: v, role: role },
      ]);
      if (ins.error) throw ins.error;
      localStorage.setItem(localKey(userCode), "1");
      toast("Voto guardado ✅");
      $("#voteArea").style.display = "none";
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudo guardar", "bad");
    } finally {
      $("#submitVote").disabled = false;
    }
  };

  // Realtime: actualizar si cierran la encuesta
  supabase
    .channel("polls-rt")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "polls", filter: "id=eq." + pollId },
      function (pl) {
        setStateTag(pl.new.is_open !== false);
      }
    )
    .subscribe();

  (async function () {
    await loadPoll();
  })();
})();
