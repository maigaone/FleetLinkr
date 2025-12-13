// Centralized Supabase configuration
window.supabaseConfig = {
    supabaseUrl: "https://klredsqvkblbhooinwwz.supabase.co",
    supabaseAnonKey: "sb_publishable_CHt4q1TQCEZXs-v62TCaxA_3vj3C6J9"
};

// Create Supabase client with proper auth persistence
window.supabaseClient = window.supabase.createClient(
    window.supabaseConfig.supabaseUrl,
    window.supabaseConfig.supabaseAnonKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true
        }
    }
);