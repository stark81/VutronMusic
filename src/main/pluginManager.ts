import { PluginInstance } from './utils/pluginManager'

class PluginManager {
  plugins = new Map<string, PluginInstance>()

  register(id: string, plugin: PluginInstance) {
    this.plugins.set(id, plugin)
  }

  get(id: string) {
    return this.plugins.get(id)
  }

  call(pluginId: string, methodName: string, params: Record<string, any>) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return Promise.reject(new Error(`Plugin ${pluginId} not found`))
    }
    return plugin.call(methodName, params)
  }
}

export const pluginManager = new PluginManager()
