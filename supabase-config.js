window.SUPABASE_CONFIG = {
  url: "https://arjwrycitgobvlodmkeo.supabase.co",
  anonKey: "sb_publishable_AWXT71G2lX4cqbdK9A9g0w_6e1EUvIl",
};

window.createSiteSupabaseClient = () => {
  const { url, anonKey } = window.SUPABASE_CONFIG;
  const normalizedUrl = url?.toLowerCase();
  const normalizedKey = anonKey?.toLowerCase();

  if (
    !url
    || !anonKey
    || normalizedUrl.includes("your_project_id")
    || normalizedKey.includes("your_publishable_or_anon_key")
  ) {
    throw new Error("Supabase is not configured. Update supabase-config.js.");
  }

  if (!window.supabase?.createClient) {
    throw new Error("The Supabase client library failed to load.");
  }

  return window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
