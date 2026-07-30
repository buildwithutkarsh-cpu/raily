/* ══════════════════════════════════════════════════════════════
   Raily AI — Request State Machine
   
   Every AI request lifecycle is an explicit finite-state machine.
   Every transition must be validated. No implicit state.
   Every request terminates in exactly one state: COMPLETE, ERROR,
   CANCELLED, or TIMEOUT. Never silently disappear.
   ══════════════════════════════════════════════════════════════ */

import {
  generateRequestId,
  RequestState,
  STATE_TRANSITIONS,
  TERMINAL_STATES,
  type RequestContext,
  type RequestId,
  type StateMachine,
} from "./types";

/* ─── Context Factory ────────────────────────────────────── */

/**
 * Create a new RequestContext with a unique requestId and
 * an AbortController for cancellation.
 */
export function createRequestContext(
  timeoutMs = 60_000
): RequestContext {
  const requestId = generateRequestId();
  const abortController = new AbortController();

  return {
    requestId,
    createdAt: Date.now(),
    timeoutMs,
    signal: abortController.signal,
    abort: (reason: string) => {
      console.log(`[${requestId}] ABORT: ${reason}`);
      abortController.abort(reason);
    },
  };
}

/* ─── Correlated Logger ──────────────────────────────────── */

/**
 * Structured logger that always includes the requestId.
 * Use this everywhere instead of bare console.log/error.
 */
export function createLogger(requestId: RequestId) {
  return {
    info: (message: string, ...args: unknown[]) => {
      console.log(`[${requestId}] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[${requestId}] WARN: ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[${requestId}] ERROR: ${message}`, ...args);
    },
    state: (from: RequestState, to: RequestState) => {
      console.log(`[${requestId}] STATE: ${from} → ${to}`);
    },
  };
}

/* ─── State Machine Implementation ───────────────────────── */

export class RequestStateMachine implements StateMachine {
  readonly context: RequestContext;
  readonly stateHistory: Array<{ from: RequestState; to: RequestState; timestamp: number }>;
  #currentState: RequestState;
  #isDisposed = false;
  #log: ReturnType<typeof createLogger>;

  private constructor(context: RequestContext) {
    this.context = context;
    this.#currentState = RequestState.IDLE;
    this.stateHistory = [];
    this.#log = createLogger(context.requestId);

    // Set up timeout
    if (context.timeoutMs > 0) {
      const timeoutId = setTimeout(() => {
        if (!this.isTerminated) {
          this.#log.warn(`Pipeline timeout after ${context.timeoutMs}ms`);
          this.forceTerminate(RequestState.TIMEOUT, "Pipeline timeout exceeded");
        }
      }, context.timeoutMs);

      // Clean up the timeout if the signal aborts
      const onAbort = () => {
        clearTimeout(timeoutId);
        if (!this.isTerminated) {
          this.forceTerminate(RequestState.CANCELLED, context.signal.reason?.toString() || "Request cancelled");
        }
      };
      context.signal.addEventListener("abort", onAbort, { once: true });

      // Also clean up if the machine is disposed externally
      const originalDispose = this.dispose.bind(this);
      this.dispose = () => {
        clearTimeout(timeoutId);
        context.signal.removeEventListener("abort", onAbort);
        originalDispose();
      };
    }
  }

  /**
   * Create a new state machine with a fresh request context.
   */
  static create(timeoutMs?: number): RequestStateMachine {
    const context = createRequestContext(timeoutMs);
    const machine = new RequestStateMachine(context);
    // Start in REQUEST_RECEIVED
    machine.transition(RequestState.REQUEST_RECEIVED);
    return machine;
  }

  /**
   * Create a state machine from an existing context (for testing).
   */
  static fromContext(context: RequestContext): RequestStateMachine {
    return new RequestStateMachine(context);
  }

  get currentState(): RequestState {
    return this.#currentState;
  }

  get isTerminated(): boolean {
    return TERMINAL_STATES.includes(this.#currentState);
  }

  get isError(): boolean {
    return (
      this.#currentState === RequestState.ERROR ||
      this.#currentState === RequestState.TIMEOUT ||
      this.#currentState === RequestState.CANCELLED
    );
  }

  /**
   * Transition to a new state. Throws if the transition is invalid
   * or if the machine is already terminated.
   */
  transition(to: RequestState): void {
    if (this.#isDisposed) {
      throw new Error(`[${this.context.requestId}] State machine is disposed — cannot transition to ${to}`);
    }

    if (this.isTerminated) {
      throw new Error(
        `[${this.context.requestId}] Cannot transition from terminal state ${this.#currentState} to ${to}`
      );
    }

    const allowed = STATE_TRANSITIONS[this.#currentState];
    if (!allowed.includes(to)) {
      throw new Error(
        `[${this.context.requestId}] Invalid state transition: ${this.#currentState} → ${to}. ` +
        `Allowed from ${this.#currentState}: ${allowed.join(", ")}`
      );
    }

    const from = this.#currentState;
    this.#currentState = to;
    this.stateHistory.push({ from, to, timestamp: Date.now() });
    this.#log.state(from, to);
  }

  /**
   * Force-terminate the machine in an error state. Does NOT validate
   * the transition — always allowed from any non-terminal state.
   * Used for timeouts, cancellations, and unrecoverable errors.
   */
  forceTerminate(state: RequestState.ERROR | RequestState.CANCELLED | RequestState.TIMEOUT, reason: string): void {
    if (this.#isDisposed) return;
    if (this.isTerminated) return;

    const from = this.#currentState;
    this.#currentState = state;
    this.stateHistory.push({ from, to: state, timestamp: Date.now() });
    this.#log.state(from, state);
    this.#log.error(`Terminated: ${state} — ${reason}`);
  }

  /**
   * Dispose the state machine and clean up resources.
   * After this, no transitions are allowed.
   */
  dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;

    if (!this.isTerminated) {
      this.forceTerminate(RequestState.CANCELLED, "State machine disposed");
    }

    this.#log.info(`Pipeline complete. Final state: ${this.#currentState}`);
    this.#log.info(`History: ${this.stateHistory.map(h => `${h.from}→${h.to}`).join(" » ")}`);
  }

  get log() {
    return this.#log;
  }

  get requestId(): RequestId {
    return this.context.requestId;
  }
}

/* ─── Convenience wrapper for OrchestrationCallbacks ─────── */

/**
 * Wraps a state machine and provides strongly-typed logging.
 * Used by the orchestrator to ensure every transition is tracked.
 */
export class OrchestrationScope {
  readonly machine: RequestStateMachine;
  readonly log: ReturnType<typeof createLogger>;
  readonly requestId: RequestId;

  constructor(machine: RequestStateMachine) {
    this.machine = machine;
    this.log = createLogger(machine.requestId);
    this.requestId = machine.requestId;
  }

  static create(timeoutMs?: number): OrchestrationScope {
    return new OrchestrationScope(RequestStateMachine.create(timeoutMs));
  }

  /**
   * Safely transition the state machine. Logs and force-terminates
   * on invalid transition instead of throwing.
   */
  safeTransition(to: RequestState): void {
    try {
      this.machine.transition(to);
    } catch (err: unknown) {
      this.log.error(
        `Invalid transition attempt: ${this.machine.currentState} → ${to}: ${err instanceof Error ? err.message : String(err)}`
      );
      this.machine.forceTerminate(RequestState.ERROR, `Invalid transition: ${this.machine.currentState} → ${to}`);
    }
  }

  /**
   * Run an async function within a state transition.
   * If the function throws, force-terminates.
   */
  async runInState<T>(state: RequestState, fn: () => Promise<T>): Promise<T | null> {
    if (this.machine.isTerminated) {
      this.log.warn(`Cannot run in state ${state} — machine is already ${this.machine.currentState}`);
      return null;
    }

    this.safeTransition(state);

    try {
      const result = await fn();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`Error in state ${state}: ${message}`);
      this.machine.forceTerminate(RequestState.ERROR, message);
      return null;
    }
  }
}
