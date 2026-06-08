import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary:", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.error) return this.props.children;
    const lang = (typeof localStorage !== "undefined" && localStorage.getItem("gastromek_lang") === "tr") ? "tr" : "de";
    const txt = lang === "tr"
      ? { title: "Bir şeyler ters gitti", desc: "Sayfa yüklenirken beklenmedik bir hata oluştu. Sorun devam ederse sayfayı yenileyin.", btn: "Ana sayfaya dön" }
      : { title: "Etwas ist schiefgelaufen", desc: "Beim Laden der Seite ist ein unerwarteter Fehler aufgetreten. Wenn das Problem weiterhin besteht, laden Sie die Seite neu.", btn: "Zur Startseite" };
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4 text-2xl">⚠</div>
          <h1 className="font-heading text-xl font-semibold text-slate-900 mb-2">
            {txt.title}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {txt.desc}
          </p>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-left overflow-auto max-h-40 text-slate-600 mb-4">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={this.handleReload}
            className="bg-brand hover:bg-brand-hover text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            data-testid="error-boundary-reload"
          >
            {txt.btn}
          </button>
        </div>
      </div>
    );
  }
}
