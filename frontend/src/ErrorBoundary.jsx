import { Component } from 'react'

/**
 * Catches client-side errors in the React tree and shows a fallback UI
 * instead of a blank screen (production error overlay).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl" aria-hidden>⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-slate-600 text-sm mb-6">
              A client-side error occurred. Try refreshing the page. If it continues, check the browser console for details.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-slate-400 font-mono mb-4 break-all text-left bg-slate-50 p-3 rounded-lg">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:opacity-90 transition"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
