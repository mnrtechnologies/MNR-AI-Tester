const cm = require("../../src/config/pricing/creditMath");

function creditsForTestCases(n) {
  return cm.creditsForStories(n);
}

// Har db-type ki apni scale hai — calibrate karna baaki hai apne data se.
const OBJECTS_PER_CREDIT_BY_TYPE = {
  postgresql: 3,
  mysql: 3,
  mongodb: 3,
  redis: 10000,
  pinecone: 10000,
};

function creditsForObjectsScanned(n, dbType) {
  const rate = OBJECTS_PER_CREDIT_BY_TYPE[dbType] || 50;
  return Math.max(1, Math.ceil(Math.max(0, n) / rate));
}

function priceDbTestRun(doc) {
  const credits =
    doc.job_type === "full_assessment"
      ? creditsForTestCases(doc.testCasesGenerated)
      : creditsForObjectsScanned(doc.objectsScanned, doc.db_type);
  return { credits, oversized: credits > 500 };
}

module.exports = {
  priceDbTestRun,
  creditsForTestCases,
  creditsForObjectsScanned,
};
