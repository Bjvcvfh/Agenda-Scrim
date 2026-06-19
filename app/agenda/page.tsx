"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UserProfile = {
  id: string;
  nickname: string;
};

type Presence = {
  id: number;
  user_id: string;
  date: string;
  hour: string;
  nickname?: string;
};

type Scrim = {
  id: number;
  date: string;
  hour: string;
  marked: boolean;
};

const horarios = ["19:00", "20:00", "21:00", "22:00", "23:00"];

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateBR(dateString: string) {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

export default function AgendaPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  const [presences, setPresences] = useState<Presence[]>([]);
  const [scrims, setScrims] = useState<Scrim[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const currentMonthDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({
        day,
        date,
        dateString: formatDateLocal(date),
        isPast: date < today,
        isToday: date.getTime() === today.getTime(),
      });
    }

    return {
      year,
      month,
      monthName: firstDay.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      days,
    };
  }, [today]);

  async function carregarUsuario() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/");
      return;
    }

    setUserId(data.user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, nickname")
      .eq("id", data.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    setLoading(false);
  }

  async function carregarDadosDoDia(date: string) {
    if (!date) return;

    setMessage("");

    const { data: presenceData, error: presenceError } = await supabase
      .from("presences")
      .select("*")
      .eq("date", date)
      .order("hour", { ascending: true })
      .order("created_at", { ascending: true });

    if (presenceError) {
      setMessage(presenceError.message);
      return;
    }

    const userIds = [...new Set((presenceData || []).map((p) => p.user_id))];

    let profilesMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);

      profilesMap = Object.fromEntries(
        (profilesData || []).map((p) => [p.id, p.nickname])
      );
    }

    const presencesWithNicknames = (presenceData || []).map((p) => ({
      ...p,
      nickname: profilesMap[p.user_id] || "Sem nickname",
    }));

    setPresences(presencesWithNicknames);

    const { data: scrimData, error: scrimError } = await supabase
      .from("scrims")
      .select("*")
      .eq("date", date);

    if (scrimError) {
      setMessage(scrimError.message);
      return;
    }

    setScrims(scrimData || []);
  }

  function selecionarDia(dateString: string, isPast: boolean) {
    if (isPast) return;

    setSelectedDate(dateString);
    setSelectedHour(null);
    carregarDadosDoDia(dateString);
  }

  function presencasDoHorario(hour: string) {
    return presences.filter((p) => p.hour === hour);
  }

  function usuarioMarcadoNoHorario(hour: string) {
    return presences.some((p) => p.hour === hour && p.user_id === userId);
  }

  function scrimMarcado(hour: string) {
    return scrims.some((s) => s.hour === hour && s.marked);
  }

  async function marcarPresenca() {
    if (!userId || !selectedDate || !selectedHour) {
      setMessage("Selecione um horário.");
      return;
    }

    const { error } = await supabase
        .from("presences")
        .upsert(
            {
            user_id: userId,
            date: selectedDate,
            hour: selectedHour,
            },
            {
            onConflict: "user_id,date,hour",
            }
        );

    if (error) {
      setMessage(error.message);
      return;
    }

    await carregarDadosDoDia(selectedDate);
  }

  async function desmarcarPresenca() {
    if (!userId || !selectedDate || !selectedHour) {
      setMessage("Selecione um horário.");
      return;
    }

    const { error } = await supabase
      .from("presences")
      .delete()
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .eq("hour", selectedHour);

    if (error) {
      setMessage(error.message);
      return;
    }

    await carregarDadosDoDia(selectedDate);
  }

  async function marcarTodos() {
    if (!userId || !selectedDate) return;

    const registros = horarios.map((hour) => ({
        user_id: userId,
        date: selectedDate,
        hour,
    }));

    const { error } = await supabase
        .from("presences")
        .upsert(registros, {
            onConflict: "user_id,date,hour",
        });

    if (error) {
      setMessage(error.message);
      return;
    }

    await carregarDadosDoDia(selectedDate);
  }

  async function desmarcarTodos() {
    if (!userId || !selectedDate) return;

    const { error } = await supabase
      .from("presences")
      .delete()
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .in("hour", horarios);

    if (error) {
      setMessage(error.message);
      return;
    }

    await carregarDadosDoDia(selectedDate);
  }

  async function alterarScrim(hour: string, marked: boolean) {
    if (!selectedDate) return;

    const { error } = await supabase
        .from("scrims")
        .upsert(
        {
            date: selectedDate,
            hour,
            marked,
            updated_at: new Date().toISOString(),
        },
        {
            onConflict: "date,hour",
        }
        );

    if (error) {
        setMessage(error.message);
        return;
    }

    await carregarDadosDoDia(selectedDate);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/");
  }

  useEffect(() => {
    carregarUsuario();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const channel = supabase
      .channel("agenda-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presences",
        },
        () => carregarDadosDoDia(selectedDate)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scrims",
        },
        () => carregarDadosDoDia(selectedDate)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Agenda Scrim</h1>
            <p className="text-zinc-400">
              Logado como:{" "}
              <span className="text-blue-400 font-semibold">
                {profile?.nickname || "Usuário"}
              </span>
            </p>
          </div>

          <button
            onClick={sair}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold"
          >
            Sair
          </button>
        </header>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
          <h2 className="text-xl font-bold mb-4 capitalize">
            {currentMonthDays.monthName}
          </h2>

          <div className="grid grid-cols-7 gap-2">
            {currentMonthDays.days.map((day) => (
              <button
                key={day.dateString}
                disabled={day.isPast}
                onClick={() => selecionarDia(day.dateString, day.isPast)}
                className={`
                  aspect-square rounded-xl border text-sm sm:text-base font-semibold
                  ${
                    selectedDate === day.dateString
                      ? "bg-blue-600 border-blue-400"
                      : "bg-zinc-800 border-zinc-700"
                  }
                  ${
                    day.isPast
                      ? "opacity-25 cursor-not-allowed"
                      : "hover:bg-blue-700"
                  }
                  ${day.isToday ? "ring-2 ring-yellow-400" : ""}
                `}
              >
                {day.day}
              </button>
            ))}
          </div>
        </section>

        {selectedDate && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h2 className="text-2xl font-bold mb-4">
              Dia selecionado: {formatDateBR(selectedDate)}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {horarios.map((hour) => {
                const lista = presencasDoHorario(hour);
                const marcado = usuarioMarcadoNoHorario(hour);

                return (
                  <div
                    key={hour}
                    onClick={() => setSelectedHour(hour)}
                    className={`
                      cursor-pointer rounded-2xl border p-4
                      ${
                        selectedHour === hour
                          ? "border-blue-400 bg-blue-950"
                          : "border-zinc-700 bg-zinc-800"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold">{hour}</h3>

                      {marcado && (
                        <span className="text-xs bg-green-600 px-2 py-1 rounded-full">
                          Você
                        </span>
                      )}
                    </div>

                    <label
                      className="flex items-center gap-2 text-sm mb-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={scrimMarcado(hour)}
                        onChange={(e) => alterarScrim(hour, e.target.checked)}
                      />
                      Scrim Marcado?
                    </label>

                    <div>
                      <p className="text-sm text-zinc-400 mb-2">
                        Presenças:
                      </p>

                      {lista.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          Ninguém marcado
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {lista.map((p) => (
                            <p
                              key={p.id}
                              className="text-sm bg-zinc-950 rounded-lg px-2 py-1"
                            >
                              {p.nickname}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={marcarPresenca}
                className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
              >
                Marcar Presença
              </button>

              <button
                onClick={desmarcarPresenca}
                className="bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold"
              >
                Desmarcar Presença
              </button>

              <button
                onClick={marcarTodos}
                className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
              >
                Marcar Todos
              </button>

              <button
                onClick={desmarcarTodos}
                className="bg-zinc-700 hover:bg-zinc-600 py-3 rounded-lg font-semibold"
              >
                Desmarcar Todos
              </button>
            </div>

            {selectedHour && (
              <p className="mt-4 text-center text-zinc-400">
                Horário selecionado:{" "}
                <span className="text-blue-400 font-bold">
                  {selectedHour}
                </span>
              </p>
            )}

            {message && (
              <p className="mt-4 text-center text-yellow-400">{message}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}