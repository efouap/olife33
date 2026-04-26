'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M1 — Wealth Creation (Trading)',
      capabilities: ['technical_analysis', 'portfolio_optimizer', 'sentiment_analysis', 'options_strategy', 'risk_sizing'],
      disclaimer: 'Educational only. Not financial advice.',
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;
    const DISCLAIMER = '\n\n⚠️ This is for educational purposes only and does not constitute financial advice.';

    switch (task) {
      case 'technical_analysis': {
        const { symbol, price_data = {}, timeframe = '1D' } = data;
        const prompt = [
          { role: 'system', content: 'You are a technical analysis AI. Apply classical and modern technical analysis methodologies.' },
          { role: 'user', content: `Symbol: ${symbol}\nTimeframe: ${timeframe}\nPrice data: ${JSON.stringify(price_data)}\n\nAnalyze: trend, key support/resistance levels, momentum indicators, volume patterns, chart patterns, and probability of key moves. Note: educational only.` },
        ];
        const analysis = await ctx.ai(prompt, { max_tokens: 1800 });
        return { symbol, timeframe, analysis: analysis + DISCLAIMER };
      }

      case 'portfolio_optimizer': {
        const { holdings = [], risk_tolerance = 'moderate', investment_horizon = '5 years' } = data;
        const prompt = [
          { role: 'system', content: 'You are a portfolio theory AI applying Modern Portfolio Theory, factor investing, and risk parity concepts.' },
          { role: 'user', content: `Holdings: ${JSON.stringify(holdings)}\nRisk tolerance: ${risk_tolerance}\nHorizon: ${investment_horizon}\n\nAnalyze: correlation matrix, concentration risk, missing asset classes, rebalancing recommendations, and expected risk/return profile. Educational analysis only.` },
        ];
        const optimization = await ctx.ai(prompt, { max_tokens: 2000 });
        return { optimization: optimization + DISCLAIMER };
      }

      case 'sentiment_analysis': {
        const { asset, news_headlines = [], social_data = {} } = data;
        const prompt = [
          { role: 'system', content: 'You analyze market sentiment from multiple data sources.' },
          { role: 'user', content: `Asset: ${asset}\nNews: ${news_headlines.join('\n')}\nSocial signals: ${JSON.stringify(social_data)}\n\nProvide: overall sentiment score (-100 to 100), sentiment breakdown by source, key narratives driving sentiment, and sentiment vs. price divergences.` },
        ];
        const sentiment = await ctx.ai(prompt, { max_tokens: 1200 });
        return { asset, sentiment };
      }

      case 'options_strategy': {
        const { underlying, outlook, iv_rank = null, portfolio_context = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are an options strategy AI. Design defined-risk options strategies appropriate for the market view.' },
          { role: 'user', content: `Underlying: ${underlying}\nOutlook: ${outlook}\nIV Rank: ${iv_rank || 'unknown'}\nContext: ${portfolio_context}\n\nSuggest 3 options strategies with: structure, max profit, max loss, breakevens, IV considerations, and management rules. Educational only.` },
        ];
        const strategy = await ctx.ai(prompt, { max_tokens: 2000 });
        return { underlying, strategy: strategy + DISCLAIMER };
      }

      case 'risk_sizing': {
        const { account_size, trade_risk_pct = 1, stop_loss_pct, entry_price } = data;
        const riskAmount = account_size * (trade_risk_pct / 100);
        const stopLossAmount = entry_price * (stop_loss_pct / 100);
        const shares = Math.floor(riskAmount / stopLossAmount);
        const positionSize = shares * entry_price;
        const positionPct = (positionSize / account_size) * 100;
        return {
          account_size,
          risk_per_trade_dollars: riskAmount.toFixed(2),
          risk_per_trade_pct: trade_risk_pct,
          entry_price,
          stop_loss_price: (entry_price * (1 - stop_loss_pct / 100)).toFixed(2),
          shares_to_buy: shares,
          position_size_dollars: positionSize.toFixed(2),
          position_size_pct: positionPct.toFixed(1),
          note: DISCLAIMER,
        };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['technical_analysis', 'portfolio_optimizer', 'sentiment_analysis', 'options_strategy', 'risk_sizing'] };
    }
  },
};
