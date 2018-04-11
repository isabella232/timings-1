const fs = require('fs');
const os = require('os');
const path = require('path');
const git = require('git-rev');
const yaml = require('js-yaml');
const nconf = require('nconf');
const pkg = require('../package.json');
const logger = require('../log.js');

/* eslint no-sync: 0 */
// Add arguments and environment variables to nconf
nconf
  .argv({
    c: {
      alias: 'config-file',
      describe: 'path to config file'
    }
  })
  .env({
    lowerCase: true,
    whitelist: ['configfile', 'node_env', 'api_host', 'host', 'http_port', 'debug', 'kb_index', 'kb_rename', 'es_upgrade',
      'es_host', 'es_port', 'es_protocol', 'es_user', 'es_passwd', 'es_ssl_cert', 'es_ssl_key', 'kb_host', 'kb_port'
    ],
    parseValues: true
  });

// Load defaults first - use './.config.js for docker-compose
let cfgFile = path.resolve('./.config.js');
let cfgConfig = require(cfgFile);

if (nconf.get('configfile') && fs.existsSync(path.resolve(nconf.get('configfile')))) {
  // User supplied config file - overwrite config!
  cfgFile = path.resolve(nconf.get('configfile'));
  const cfgFileExt = cfgFile.substr((cfgFile.lastIndexOf('.') + 1));
  if (cfgFileExt === 'js') {
    cfgConfig = require(cfgFile);
  } else {
    cfgConfig = yaml.safeLoad(fs.readFileSync(cfgFile, { encoding: 'utf-8' }));
  }
}

// Check for missing keys
if (!cfgConfig.env) {
  cfgConfig.env = {};
}
if (!cfgConfig.params) {
  cfgConfig.params = {};
}
if (!cfgConfig.params.defaults) {
  cfgConfig.params.defaults = {};
}
if (!cfgConfig.params.defaults.baseline) {
  cfgConfig.params.defaults.baseline = {};
}
if (!cfgConfig.params.defaults.flags) {
  cfgConfig.params.defaults.flags = {};
}

// Combine ENV variables with config - ENV is leading!
const cfgNconf = {
  env: {
    ES_PROTOCOL: nconf.get('es_protocol') || cfgConfig.env.ES_PROTOCOL || 'http',
    ES_HOST: nconf.get('es_host') || cfgConfig.env.ES_HOST || nconf.get('kb_host') ||  cfgConfig.env.KB_HOST || '',
    ES_PORT: nconf.get('es_port') || cfgConfig.env.ES_PORT || 9200,
    ES_USER: nconf.get('es_user') || cfgConfig.env.ES_USER || '',
    ES_PASS: nconf.get('es_pass') || cfgConfig.env.ES_PASS || '',
    ES_SSL_CERT: nconf.get('es_ssl_cert') || cfgConfig.env.ES_SSL_CERT || '',
    ES_SSL_KEY: nconf.get('es_ssl_key') || cfgConfig.env.ES_SSL_KEY || '',
    KB_HOST: nconf.get('kb_host') || cfgConfig.env.KB_HOST || nconf.get('es_host') || cfgConfig.env.ES_HOST || '',
    KB_PORT: nconf.get('kb_port') || cfgConfig.env.KB_PORT || 5601,
    KB_INDEX: nconf.get('kb_index') || cfgConfig.env.KB_INDEX || '.kibana',
    KB_RENAME: nconf.get('kb_rename') || cfgConfig.env.KB_RENAME || '',
    HTTP_PORT: nconf.get('http_port') || cfgConfig.env.HTTP_PORT || 80,
    DEBUG: nconf.get('debug') || cfgConfig.env.DEBUG || false,
    APP_NAME: pkg.name,
    // APP_VERSION: pkg['timings-api'].api_version || '0.0.0',
    APP_CONFIG: cfgFile,
    HOST: nconf.get('api_host') || nconf.get('host') || os.hostname(),
    NODE_ENV: nconf.get('node_env') || 'development',
    INDEX_PERF: 'cicd-perf',
    INDEX_RES: 'cicd-resource',
    INDEX_ERR: 'cicd-errorlog',
    useES: false
  },
  params: {
    required: cfgConfig.params.required || ['log.test_info', 'log.env_tester', 'log.team', 'log.browser', 'log.env_target'],
    defaults: {
      baseline: {
        days: cfgConfig.params.defaults.baseline.days || 7,
        perc: cfgConfig.params.defaults.baseline.perc || 75,
        padding: cfgConfig.params.defaults.baseline.padding || 1.2
      },
      flags: {
        assertBaseline: cfgConfig.params.defaults.flags.assertBaseline || true,
        debug: cfgConfig.params.defaults.flags.debug || false,
        esTrace: cfgConfig.params.defaults.flags.esTrace || false,
        esCreate: cfgConfig.params.defaults.flags.esCreate || false,
        passOnFailedAssert: cfgConfig.params.defaults.flags.passOnFailedAssert || false
      }
    }
  }
};

// Add git release
git.tag(tag => {
  nconf.set('env:APP_VERSION', tag.replace('v', ''));
  const env = nconf.get('env');
  logger.debug(`[timings API] - [CONFIG] Following settings are in use: \n${JSON.stringify(nconf.get(), null, 2)}`);
  logger.info(`[timings API] - [CONFIG] using config [${cfgFile}]`);
  logger.info(`[timings API] - [READY] v${env.APP_VERSION} is running at http://${env.HOST}:${env.HTTP_PORT}`);
});

// Finally, load config object into nconf
nconf
  .use('memory')
  .defaults(cfgNconf);

// Set logging level based on DEBUG variable
if (nconf.get('env:DEBUG') !== true) {
  logger.transports.console.level = 'info';
}

module.exports.nconf = nconf;
