import { trace } from '@opentelemetry/api'
import * as SharedModule from '@orpc/shared'
import pkg from '../package.json'
import { ORPCInstrumentation } from './instrumentation'
import { OpenTelemetryTracer } from './tracer'

const setTracerSpy = vi.spyOn(SharedModule, 'setTracer').mockImplementation(() => {})
const getTracerSpy = vi.spyOn(trace, 'getTracer')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('oRPCInstrumentation', () => {
  it('should initialize the instrumentation and enable by default', () => {
    void new ORPCInstrumentation()

    expect(getTracerSpy).toHaveBeenCalledWith(pkg.name, pkg.version)
    expect(setTracerSpy).toHaveBeenCalledTimes(1)

    const tracer = setTracerSpy.mock.calls[0]![0]
    expect(tracer).toBeInstanceOf(OpenTelemetryTracer)
    expect(tracer!.inject).toBeTypeOf('function')
    expect(tracer!.extract).toBeTypeOf('function')
  })

  it('should support propagationEnabled=false', () => {
    void new ORPCInstrumentation({ propagationEnabled: false })

    const tracer = setTracerSpy.mock.calls[0]![0]
    expect(tracer).toBeInstanceOf(OpenTelemetryTracer)
    expect(tracer!.inject).toBeUndefined()
    expect(tracer!.extract).toBeUndefined()
  })

  it('should not enable if enabled=false', () => {
    void new ORPCInstrumentation({ enabled: false })
    expect(setTracerSpy).not.toHaveBeenCalled()
  })

  it('can disable the instrumentation', () => {
    const instrumentation = new ORPCInstrumentation()
    instrumentation.disable()
    expect(setTracerSpy).toHaveBeenCalledWith(undefined)
  })
})
