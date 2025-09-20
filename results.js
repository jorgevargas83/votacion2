(function () {
  var supabase = App.supabase,
    qs = App.qs,
    $ = App.$,
    fmt = App.fmt,
    toast = App.toast;

  var pollId = qs("poll");
  var poll = null;

  function setHeader() {
    $("#board").style.display = "grid";
    $("#rTitle").textContent = poll.title;
    var open = poll.is_open !== false;
    $("#rState").textContent = open ? "Abierta" : "Cerrada";
    $("#rState").className = "tag " + (open ? "ok" : "bad");
  }

  function render(votes) {
    var jcodes = ["JUEZ1", "JUEZ2", "JUEZ3"],
      pcodes = ["PUBLICO1", "PUBLICO2", "PUBLICO3"],
      by = {};

    votes.forEach((v) => (by[v.user_code] = v.score));

    // Jueces
    var sumJ = 0;
    $("#judges").innerHTML = jcodes
      .map((c) => {
        var sc = by[c];
        sumJ += Number(sc || 0);
        return `<li>${c}: <strong>${sc != null ? fmt(sc) : "—"}</strong></li>`;
      })
      .join("");
    $("#sumJ").textContent = fmt(sumJ);
    $("#barJ").style.width = Math.min(100, (sumJ / 30) * 100) + "%";

    // Público
    var arrP = pcodes.map((c) => Number(by[c] || 0));
    var cntP = pcodes.filter((c) => by[c] != null).length;
    var avgP = cntP ? arrP.reduce((a, b) => a + b, 0) / cntP : 0;

    $("#public").innerHTML = pcodes
      .map((c) => {
        var sc = by[c];
        return `<li>${c}: <strong>${sc != null ? fmt(sc) : "—"}</strong></li>`;
      })
      .join("");
    $("#avgP").textContent = fmt(avgP);
    $("#barP").style.width = Math.min(100, (avgP / 10) * 100) + "%";

    // Total
    var total = sumJ + avgP;
    $("#total").textContent = fmt(total);
    $("#barT").style.width = Math.min(100, (total / 40) * 100) + "%";
  }

  async function ensureOrPick() {
    if (!pollId) {
      $("#pick").style.display = "block";
      var q = await supabase
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (q.error) {
        $("#list").textContent = "Error";
        return false;
      }

      $("#list").innerHTML = (q.data || [])
        .map(
          (p) =>
            `<div class="card"><h4>${p.title}</h4><button onclick="location.href='results.html?poll=${p.id}'">Ver resultados</button></div>`
        )
        .join("");

      return false;
    }

    var r = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (r.error) {
      toast("No se encontró la encuesta", "bad");
      return false;
    }
    poll = r.data;
    setHeader();
    return true;
  }

  async function loadVotes() {
    var r = await supabase
      .from("votes")
      .select("user_code, score")
      .eq("poll_id", pollId);
    if (r.error) {
      console.error(r.error);
      return;
    }
    render(r.data || []);
  }

  function subscribe() {
    supabase
      .channel("votes-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: "poll_id=eq." + pollId },
        loadVotes
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "votes", filter: "poll_id=eq." + pollId },
        loadVotes
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "votes", filter: "poll_id=eq." + pollId },
        loadVotes
      )
      .subscribe();

    supabase
      .channel("polls-rt2")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "polls", filter: "id=eq." + pollId },
        function (pl) {
          poll = pl.new;
          setHeader();
        }
      )
      .subscribe();
  }

  (async function () {
    if (await ensureOrPick()) {
      await loadVotes();
      subscribe();
    }
  })();
})();
