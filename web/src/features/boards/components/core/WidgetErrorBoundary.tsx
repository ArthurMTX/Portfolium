import { Component, ReactNode } from 'react'
import { WidgetErrorState } from '@/features/boards/components/widgets/base/WidgetErrorState'

interface WidgetErrorBoundaryProps {
  widgetId: string
  children: ReactNode
}

interface WidgetErrorBoundaryState {
  error: Error | null
}

/**
 * Isolates a single widget's render errors so one broken widget doesn't
 * take down the rest of the board. BaseWidget only covers data-fetch errors
 * passed in as props; this catches errors thrown during render itself.
 */
export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[WidgetErrorBoundary] Widget "${this.props.widgetId}" failed to render:`, error)
  }

  componentDidUpdate(prevProps: WidgetErrorBoundaryProps) {
    if (this.state.error && prevProps.widgetId !== this.props.widgetId) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card h-full flex flex-col">
          <WidgetErrorState error={this.state.error} />
        </div>
      )
    }

    return this.props.children
  }
}
