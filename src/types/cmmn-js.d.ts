declare module 'cmmn-js/lib/Modeler' {
  export default class CmmnModeler {
    constructor(options?: Record<string, unknown>)
    importXML(xml: string, done: (err?: Error) => void): void
    saveXML(options: { format?: boolean }, done: (err: Error | null, xml?: string) => void): void
    saveSVG(done: (err: Error | null, svg?: string) => void): void
    get<T = unknown>(name: string): T
    on(event: string, callback: (...args: unknown[]) => void): void
    destroy(): void
  }
}
