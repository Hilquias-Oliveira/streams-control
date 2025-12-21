import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h1>
                        <p className="text-gray-500 mb-6">Ocorreu um erro inesperado na aplicação.</p>

                        <details className="text-left bg-gray-50 p-4 rounded-xl mb-6 overflow-auto max-h-40 text-xs text-gray-500 font-mono">
                            {this.state.error && this.state.error.toString()}
                        </details>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                        >
                            Recarregar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
