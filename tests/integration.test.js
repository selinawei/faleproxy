const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

describe('Integration Tests', () => {
  let app;
  let request;

  beforeAll(() => {
    // Mock all external HTTP requests
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Import the app directly instead of spawning a process
    // We need to clear the cache first to get a fresh instance
    delete require.cache[require.resolve('../app.js')];
    app = require('../app.js');
    request = require('supertest')(app);
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    // Close the server if it's running
    if (app && app.close) {
      app.close();
    }
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    // Make a request to our proxy app
    const response = await request
      .post('/fetch')
      .send({ url: 'https://example.com/' })
      .expect(200);

    expect(response.body.success).toBe(true);

    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(response.body.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');

    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);

    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    const response = await request
      .post('/fetch')
      .send({ url: 'not-a-valid-url' })
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  test('Should handle missing URL parameter', async () => {
    const response = await request
      .post('/fetch')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('URL is required');
  });
});
