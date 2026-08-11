import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Лозинката е успешно променета!");
    }
  };

  return (
    <div>
      <h1>Промени лозинка</h1>

      <form onSubmit={handleReset}>
        <input
          type="password"
          placeholder="Нова лозинка"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">
          Промени лозинка
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}