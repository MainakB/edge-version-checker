import childProcess from 'child_process';
import {launch} from 'chromium-edge-launcher';
import fs from 'fs';
import http from 'http';
import path from 'path';

const runShellCommand = async (command: any) =>
  new Promise((resolve, reject) => {
    childProcess.exec(command, (err: any, commandOutput: any, commandError: any) => {
      const errorThrown = err || commandError;
      if (errorThrown) {
        reject(errorThrown);
        return;
      }
      resolve(commandOutput);
    });
  });

const getRequestLocalEdgeVersion = (options: any) =>
  new Promise((resolve, reject) => {
    const request = http.get(options, (response: any) => {
      let data = '';
      response.on('data', (chunk: any) => {
        data += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(data));
        }
      });
    });
    request.setTimeout(5000, () => {
      request.abort();
    });

    request.on('error', reject);
  });

function canAccess(file: string | undefined): Boolean {
  if (!file) {
    return false;
  }

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

function getLocalAppDataPath(appPath: string): string {
  // eslint-disable-next-line no-useless-escape
  const userRegExp = /\/mnt\/([a-z])\/Users\/([^\/:]+)\/AppData\//;
  const results = userRegExp.exec(appPath) || [];

  return `/mnt/${results[1]}/Users/${results[2]}/AppData/Local`;
}

function getWinEdgePath() {
  const installations: Array<string> = [];
  const suffixes = [
    `${path.sep}Microsoft${path.sep}Edge SxS${path.sep}Application${path.sep}edge.exe`,
    `${path.sep}Microsoft${path.sep}Edge${path.sep}Application${path.sep}edge.exe`,
    `${path.sep}Microsoft${path.sep}Edge SxS${path.sep}Application${path.sep}msedge.exe`,
    `${path.sep}Microsoft${path.sep}Edge${path.sep}Application${path.sep}msedge.exe`,
  ];
  const prefixes = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(
    Boolean
  ) as string[];
  console.log('mhgjhfhmgv', prefixes);
  prefixes.forEach(prefix =>
    suffixes.forEach(suffix => {
      const edgePath = path.join(prefix, suffix);
      if (canAccess(edgePath)) {
        installations.push(edgePath);
      }
    })
  );
  return installations[installations.length - 1];
}

function wsl() {
  // Manually populate the environment variables assuming it's the default config
  process.env.LOCALAPPDATA = getLocalAppDataPath(`${process.env.PATH}`);
  process.env.PROGRAMFILES = '/mnt/c/Program Files';
  process.env['PROGRAMFILES(X86)'] = '/mnt/c/Program Files (x86)';

  return getWinEdgePath();
}

async function getInstalledChromiumEdgeVersion() {
  const edgeFlags = ['--headless', '--disable-gpu'];

  let launchFlags: any = {
    edgeFlags,
  };

  if (process.platform === 'win32') {
    const edgePath = wsl();
    launchFlags = {...launchFlags, edgePath};
  }
  const edgeInstance = await launch({
    ...launchFlags,
  } as any);

  const options = {
    host: '127.0.0.1',
    port: edgeInstance.port,
    path: '/json/version',
    requestType: 'GET',
  };
  const response: any = await getRequestLocalEdgeVersion(options);
  await edgeInstance.kill();

  return response.Browser.split('/')[1];
}

async function readVersion() {
  let currentVersion: any;
  if (process.env.JENKINS_CI) {
    currentVersion = await runShellCommand("echo $(google-chrome --version | awk '{print $3}')");
  } else {
    currentVersion = await getInstalledChromiumEdgeVersion();
  }

  console.log(`Installed MS Edge browser version is ${currentVersion}`);
  return currentVersion;
}

export async function getChromiumEdgedriver() {
  let edgeDriverValue: string | null = null;
  try {
    edgeDriverValue = await readVersion();

    if (!edgeDriverValue) {
      throw new Error(`Invalid edgedriver type of ${edgeDriverValue}`);
    }
  } catch (err) {
    throw new Error('Error thrown in edgedriver auto selection: ' + err);
  }
  return edgeDriverValue;
}
