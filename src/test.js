const { lmna, aioDownloader } = require("@lmna22/aio-downloader");

async function test() {
  const result = await aioDownloader("https://twitter.com/saho45_45/status/2046060535024865791");

  console.log(result);
}

test();
