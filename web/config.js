// Supabase connection for the quiz site.
// The anon key is meant to be public: it can only read the quiz tables (RLS select-only)
// and call run_quiz_sql after the user signs in. Never put the service_role key here.
window.QUIZ_CONFIG = {
  supabaseUrl: "https://xhxjetcmwanygtujnxrn.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeGpldGNtd2FueWd0dWpueHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTc1NjgsImV4cCI6MjEwODAzMzU2OH0.9BooKEOklYzjuL-BL4Dp20BWY6ioInWZ8bThf21fiTk",
};
