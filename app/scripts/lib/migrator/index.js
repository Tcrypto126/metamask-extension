const EventEmitter = require('events')

class Migrator extends EventEmitter {

  constructor (opts = {}) {
    super()
    const migrations = opts.migrations || []
    // sort migrations by version
    this.migrations = migrations.sort((a, b) => a.version - b.version)
    // grab migration with highest version
    const lastMigration = this.migrations.slice(-1)[0]
    // use specified defaultVersion or highest migration version
    this.defaultVersion = opts.defaultVersion || (lastMigration && lastMigration.version) || 0
  }

  // run all pending migrations on meta in place
  async migrateData (versionedData = this.generateInitialState()) {
    // get all migrations that have not yet been run
    const pendingMigrations = this.migrations.filter(migrationIsPending)

    // perform each migration
    for (const index in pendingMigrations) {
      const migration = pendingMigrations[index]
      try {
        // attempt migration and validate
        const migratedData = await migration.migrate(versionedData)
        if (!migratedData.data) throw new Error('Migrator - migration returned empty data')
        if (migratedData.version !== undefined && migratedData.meta.version !== migration.version) throw new Error('Migrator - Migration did not update version number correctly')
        // accept the migration as good
        versionedData = migratedData
      } catch (err) {
        // emit error instead of throw so as to not break the run (gracefully fail)
        const error = new Error(`MetaMask Migration Error #${migration.version}:\n${err.stack}`)
        this.emit('error', error)
        // stop migrating and use state as is
        return versionedData
      }
    }

    return versionedData

    // migration is "pending" if it has a higher
    // version number than currentVersion
    function migrationIsPending (migration) {
      return migration.version > versionedData.meta.version
    }
  }

  generateInitialState (initState) {
    return {
      meta: {
        version: this.defaultVersion,
      },
      data: initState,
    }
  }

}

module.exports = Migrator
