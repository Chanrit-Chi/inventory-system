// Injectable token getter/setter for the API client.
// Defaults to localStorage('omnipos_token') but can be reconfigured
// (e.g. for tests or non-browser environments) via tokenStore.configure().
let _getter: () => string | null = () => localStorage.getItem('omnipos_token')
let _setter: (val: string | null) => void = (val) => {
  if (val) localStorage.setItem('omnipos_token', val)
  else localStorage.removeItem('omnipos_token')
}

export const tokenStore = {
  get: () => _getter(),
  set: (val: string | null) => _setter(val),
  clear: () => _setter(null),
  configure: (getter: () => string | null, setter: (val: string | null) => void) => {
    _getter = getter
    _setter = setter
  },
}