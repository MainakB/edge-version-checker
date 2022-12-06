import childProcess from 'child_process';
import {launch} from 'chromium-edge-launcher';
import http from 'http';

const runShellCommand = async (command: any) => new Promise((resolve, reject) => {
    childProcess.exec(command, (err: any, commandOutput: any, commandError: any) => {
      const errorThrown = err || commandError;
      if (errorThrown) {
        reject(errorThrown);
        return;
      }
      resolve(commandOutput);
    });
  });

const getRequestLocalEdgeVersion = (options: any) => new Promise((resolve, reject) => {
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

async function getInstalledChromiumEdgeVersion() {
  const edgeFlags = ['--headless', '--disable-gpu'];
  const edgeInstance = await launch({
    edgeFlags,
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
