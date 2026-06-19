"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nickname, setNickname] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function fazerLogin() {
    setMensagem("");
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setMensagem(error.message);
      return;
    }

    router.push("/agenda");
  }

  async function fazerCadastro() {
    setMensagem("");

    if (!nickname.trim()) {
      setMensagem("Informe um nickname.");
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      setCarregando(false);
      setMensagem(error.message);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        nickname: nickname.trim(),
      });

      if (profileError) {
        setCarregando(false);
        setMensagem(profileError.message);
        return;
      }
    }

    setCarregando(false);
    setMensagem("Cadastro realizado. Agora faça login.");
    setModo("login");
  }

  async function enviarFormulario(e: React.FormEvent) {
    e.preventDefault();

    if (modo === "login") {
      await fazerLogin();
    } else {
      await fazerCadastro();
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-2">
          Agenda Scrim
        </h1>

        <p className="text-zinc-400 text-center mb-6">
          Entre ou cadastre-se para marcar presença.
        </p>

        <div className="flex mb-6 bg-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setModo("login")}
            className={`w-1/2 py-2 rounded-lg ${
              modo === "login" ? "bg-blue-600" : "text-zinc-400"
            }`}
          >
            Login
          </button>

          <button
            onClick={() => setModo("cadastro")}
            className={`w-1/2 py-2 rounded-lg ${
              modo === "cadastro" ? "bg-blue-600" : "text-zinc-400"
            }`}
          >
            Cadastro
          </button>
        </div>

        <form onSubmit={enviarFormulario} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              E-mail/Login
            </label>
            <input
              type="email"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Senha
            </label>
            <input
              type="password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 outline-none focus:border-blue-500"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {modo === "cadastro" && (
            <div>
              <label className="block text-sm mb-1 text-zinc-300">
                Nickname
              </label>
              <input
                type="text"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-3 outline-none focus:border-blue-500"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg py-3 font-semibold"
          >
            {carregando
              ? "Carregando..."
              : modo === "login"
              ? "Entrar"
              : "Cadastrar"}
          </button>
        </form>

        {mensagem && (
          <p className="mt-4 text-center text-sm text-yellow-400">
            {mensagem}
          </p>
        )}
      </div>
    </main>
  );
}