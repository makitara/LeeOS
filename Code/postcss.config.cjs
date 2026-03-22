const safeRequire = (name) => {
  try {
    return require(name)
  } catch {
    return null
  }
}

const autoprefixer = safeRequire('autoprefixer')

module.exports = {
  plugins: [
    ...(autoprefixer ? [autoprefixer({})] : []),
  ],
}
