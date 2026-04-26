'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M2 — Efficiency (Delivery & Procurement)',
      capabilities: ['product_sourcing', 'price_comparison', 'delivery_optimization', 'supplier_research', 'bulk_negotiation'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'product_sourcing': {
        const { product, quantity = 1, budget, quality_tier = 'mid', use_case = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE Procurement Intelligence. Find the best products at the best prices.' },
          { role: 'user', content: `Product: ${product}\nQuantity: ${quantity}\nBudget: ${budget}\nQuality: ${quality_tier}\nUse case: ${use_case}\n\nProvide: 1) top 5 specific products/brands, 2) where to buy, 3) price ranges, 4) quality indicators, 5) red flags to avoid, 6) best time to buy` },
        ];
        const sourcing = await ctx.ai(prompt, { max_tokens: 1800 });
        return { product, sourcing };
      }

      case 'price_comparison': {
        const { item, specs = {}, target_price = null } = data;
        const prompt = [
          { role: 'system', content: 'You are a price intelligence AI. Find the best deals across all channels.' },
          { role: 'user', content: `Item: ${item}\nSpecs: ${JSON.stringify(specs)}\nTarget price: ${target_price || 'minimize'}\n\nCompare: retail, Amazon, eBay (used/refurb), wholesale, B2B channels, cashback portals. Include total cost (shipping, taxes) and reliability ratings.` },
        ];
        const comparison = await ctx.ai(prompt, { max_tokens: 1500 });
        return { item, comparison };
      }

      case 'delivery_optimization': {
        const { items = [], locations = [], deadline, cost_priority = 0.5 } = data;
        const prompt = [
          { role: 'system', content: 'You are a logistics optimization AI.' },
          { role: 'user', content: `Items to deliver: ${items.join(', ')}\nLocations: ${locations.join(', ')}\nDeadline: ${deadline}\nCost vs speed priority: ${cost_priority} (0=cost, 1=speed)\n\nOptimize: carrier selection, consolidation opportunities, timing, and cost reduction strategies.` },
        ];
        const plan = await ctx.ai(prompt, { max_tokens: 1200 });
        return { plan };
      }

      case 'supplier_research': {
        const { product_category, volume, quality_requirements = [], preferred_regions = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a B2B procurement intelligence AI.' },
          { role: 'user', content: `Category: ${product_category}\nVolume: ${volume}\nQuality needs: ${quality_requirements.join(', ')}\nRegions: ${preferred_regions.join(', ')}\n\nMap supplier landscape: tier-1 suppliers, directories to search, qualification questions, typical MOQs, payment terms, and vetting process.` },
        ];
        const research = await ctx.ai(prompt, { max_tokens: 1500 });
        return { product_category, research };
      }

      case 'bulk_negotiation': {
        const { vendor, product, current_price, quantity, relationship_length = '0 months' } = data;
        const prompt = [
          { role: 'system', content: 'You are a procurement negotiation AI. Get the best price without damaging relationships.' },
          { role: 'user', content: `Vendor: ${vendor}\nProduct: ${product}\nCurrent price: ${current_price}\nQuantity: ${quantity}\nRelationship: ${relationship_length}\n\nCreate: negotiation script, target price, walk-away price, concessions to offer, and timing strategy.` },
        ];
        const strategy = await ctx.ai(prompt, { max_tokens: 1200 });
        return { vendor, product, strategy };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['product_sourcing', 'price_comparison', 'delivery_optimization', 'supplier_research', 'bulk_negotiation'] };
    }
  },
};
