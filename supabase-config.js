// Centralized Supabase configuration
window.supabaseConfig = {
    supabaseUrl: "https://klredsqvkblbhooinwwz.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscmVkc3F2a2JsYmhvb2lud3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjIzMzEsImV4cCI6MjA3OTQ5ODMzMX0.b8TLcQcA-5YyNo1jcL0L7bov29Q_0ocQXlqCU1ocOk8"
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