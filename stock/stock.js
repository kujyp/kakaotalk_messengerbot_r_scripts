const scriptName = "stock";

const MARKET_KOSPI = "코스피";
const MARKET_KOSDAQ = "코스닥";
const MARKET_NASDAQ = "나스닥";
const MARKET_NYSE = "뉴욕증시";
const GOOGLE_MINUS_CHARACTER = "−";

const COMMAND_PREFIX_KOREAN = "/주가 ";
const COMMAND_PREFIX_KOREAN2 = "/ㅈ ";
const COMMAND_PREFIX_ENGLISH = "/stock ";

const WAKEWORD = "kujypbot ";
const DEBUGWORD = "debug ";

function getGoogleStockPrice(name, code, replier, debugFlag) {
  const document = org.jsoup.Jsoup.connect("https://www.google.com/search?q=%EC%A3%BC%EA%B0%80 " + name)
      .get();
  if (debugFlag) {
    replier.reply("[getGoogleStockPrice] name\n" + name);
    replier.reply("[getGoogleStockPrice] code\n" + code);
  }
  const currentPrice = parseFloat((document.select("span[class=IsqQVc NprOob wT3VGc]").first().text()));
  if (debugFlag) {
    replier.reply("[getGoogleStockPrice] currentPrice\n" + currentPrice);
  }

  const incdec = parseFloat(document.select("span[jsname=qRSVye]").first().text().replace(GOOGLE_MINUS_CHARACTER, "-"));
  if (debugFlag) {
    replier.reply("[getGoogleStockPrice] incdec\n" + incdec);
  }

  let incdecRate = document.select("span[jsname=rfaVEf]").first().text().replace(/[()%]/g, "");
  if (debugFlag) {
    replier.reply("[getGoogleStockPrice] incdecRate\n" + incdecRate);
  }

  if (incdec < 0) {
    incdecRate = -incdecRate;
  }

  if (debugFlag) {
    replier.reply(
        "[getGoogleStockPrice]\n"
        + "name: [" + name + "]" + "\n"
        + "code: [" + code + "]" + "\n"
        + "currentPrice: [" + currentPrice + "]" + "\n"
        + "incdec: [" + incdec + "]" + "\n"
        + "incdecRate: [" + incdecRate + "]" + "\n"
    );
  }

  return {
    name: name,
    code: code,
    currentPrice: currentPrice,
    incdec: incdec,
    incdecRate: incdecRate,
  };
}

function getKoreanStockPrice(name, code) {
  const document = org.jsoup.Jsoup.connect("https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM%3A" + code)
      .get();
  const jsonObject = JSON.parse(document.text());
  const data = jsonObject.result
      .areas[0]
      .datas[0];
  const currentPrice = data.nv;
  const prevDayClosePrice = data.sv;
  let incdecRate = data.cr;
  if (currentPrice < prevDayClosePrice) {
    incdecRate = -1 * incdecRate;
  }
  const incdec = currentPrice - prevDayClosePrice;

  return {
    name: name,
    code: code,
    currentPrice: currentPrice,
    prevDayClosePrice: prevDayClosePrice,
    incdec: incdec,
    incdecRate: incdecRate,
  };
}

function generateResponse(stockInfo, replier, debugFlag) {
  let incdecPrefix;
  if (debugFlag) {
    replier.reply("[generateResponse]\n"
        + stockInfo.name + "\n"
        + stockInfo.price + "\n"
        + stockInfo.currency + "\n"
        + stockInfo.incdec + "\n"
        + stockInfo.incdecRate + "\n");
  }
  if (stockInfo.incdecRate == 0) {
    incdecPrefix = " "
  } else if (stockInfo.incdecRate > 0) {
    incdecPrefix = "▲"
  } else {
    incdecPrefix = "▼"
  }

  return "실시간 " + stockInfo.market + ": " + stockInfo.name + " 시세\n"
      + stockInfo.currentPrice + " " + stockInfo.currency + " " + incdecPrefix + stockInfo.incdec + "(" + stockInfo.incdecRate + "%" + ")";
}

function getStockInfo(stockName, replier, debugFlag) {
  const document = org.jsoup.Jsoup.connect("https://www.google.com/search?q=%EC%A3%BC%EA%B0%80 " + stockName)
      .get();

  const nameElement = document.select("span[class=aMEhee PZPZlf]").first();
  if (debugFlag) {
    replier.reply("nameElement\n" + nameElement);
  }
  if (!nameElement) {
    return null;
  }
  const name = nameElement.text();
  let codeElement = document.select("div[class=wx62f PZPZlf x7XAkb]").first();
  if (codeElement == null) {
    codeElement = document.select("div[class=HfMth PZPZlf]").first();
  }
  if (codeElement == null) {
    codeElement = document.select("div[class=iAIpCb PZPZlf]").first();
  }
  const rawCode = codeElement.text();
  let code = null;
  let market = null;
  if (rawCode.startsWith("KRX: ")) {
    code = rawCode.substring("KRX: ".length);
    market = MARKET_KOSPI;
  } else if (rawCode.startsWith("KOSDAQ: ")) {
    code = rawCode.substring("KOSDAQ: ".length);
    market = MARKET_KOSDAQ;
  } else if (rawCode.startsWith("NASDAQ: ")) {
    code = rawCode.substring("NASDAQ: ".length);
    market = MARKET_NASDAQ;
  } else if (rawCode.startsWith("NYSE: ")) {
    code = rawCode.substring("NYSE: ".length);
    market = MARKET_NYSE;
  } else if (rawCode && rawCode.includes(":")) {
    code = rawCode.split(": ")[1];
    market = rawCode.split(": ")[0];
    if (debugFlag) {
      replier.reply("code\n" + code);
      replier.reply("market\n" + market);
    }
  } else {
    return null;
  }

  return {
    name: name,
    market: market,
    code: code,
  };
}

function getStockPriceWithQuery(stockName, replier, debugFlag) {
  const stockInfo = getStockInfo(stockName, replier, debugFlag);
  if (!stockInfo) {
    return null;
  }
  if (debugFlag) {
    replier.reply("[getStockPriceWithQuery] stockInfo\n" + stockInfo);
  }

  if (stockInfo.market == MARKET_KOSPI || stockInfo.market == MARKET_KOSDAQ) {
    let ret = getKoreanStockPrice(stockInfo.name, stockInfo.code);
    return Object.assign({}, stockInfo, ret, {currency: "KRW"});
  } else if (
      (stockInfo.market == MARKET_NYSE || stockInfo.market == MARKET_NASDAQ)
      || (stockInfo.market != null)
  ) {
    let ret = getGoogleStockPrice(stockName, stockInfo.code, replier, debugFlag);
    return Object.assign({}, stockInfo, ret, {currency: "USD"});
  } else {
    return null;
  }
}


function extractStockQuery(msg) {
  if (msg.indexOf(COMMAND_PREFIX_KOREAN) !== -1) {
    return msg.substring(COMMAND_PREFIX_KOREAN.length);
  }
  if (msg.indexOf(COMMAND_PREFIX_KOREAN2) !== -1) {
    return msg.substring(COMMAND_PREFIX_KOREAN2.length);
  }
  if (msg.indexOf(COMMAND_PREFIX_ENGLISH) !== -1) {
    return msg.substring(COMMAND_PREFIX_ENGLISH.length);
  }
  return null;
}

function process(msg, replier, debugFlag) {
  const stockQuery = extractStockQuery(msg)
  if (stockQuery) {
    const stockInfo = getStockPriceWithQuery(stockQuery, replier, debugFlag);
    if (debugFlag) {
      replier.reply("요청: [" + stockQuery + "]")
    }

    if (!stockInfo) {
      if (debugFlag) {
        replier.reply("getStockPriceWithQuery 실패")
      }
      replier.reply("[" + stockQuery + "]" + " 종목을 찾을수 없습니다.")
      return;
    }

    if (debugFlag) {
      replier.reply("getStockPriceWithQuery: name[" + stockInfo.name + "], code[" + stockInfo.code + "]")
    }

    replier.reply(generateResponse(stockInfo, replier, debugFlag));
  }
}

/**
 * (string) room
 * (string) sender
 * (boolean) isGroupChat
 * (void) replier.reply(message)
 * (boolean) replier.reply(room, message, hideErrorToast = false) // 전송 성공시 true, 실패시 false 반환
 * (string) imageDB.getProfileBase64()
 * (string) packageName
 */
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  let debugFlag = false;
  let preprocessedMessage = msg;
  if (preprocessedMessage.startsWith(DEBUGWORD)) {
    debugFlag = true;
    preprocessedMessage = preprocessedMessage.substring(DEBUGWORD.length)
  }

  if ((!WAKEWORD) || preprocessedMessage.startsWith(WAKEWORD)) {
    preprocessedMessage = preprocessedMessage.substring(WAKEWORD.length)
    try {
      process(preprocessedMessage, replier, debugFlag);
    } catch (e) {
      if (debugFlag) {
        replier.reply(e)
      }
      replier.reply("[" + msg + "] 에러 발생")
    }
  }
}

//아래 4개의 메소드는 액티비티 화면을 수정할때 사용됩니다.
function onCreate(savedInstanceState, activity) {
  var textView = new android.widget.TextView(activity);
  textView.setText("Hello, World!");
  textView.setTextColor(android.graphics.Color.DKGRAY);
  activity.setContentView(textView);
}

function onStart(activity) {}

function onResume(activity) {}

function onPause(activity) {}

function onStop(activity) {}
