'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M2 — Efficiency',
      capabilities: ['travel_plan', 'restaurant_research', 'task_automation', 'vendor_research', 'event_access'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'travel_plan': {
        const { destination, dates, budget, style = 'balanced', interests = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE M2 Concierge AI. You craft exceptional travel experiences with insider knowledge and attention to detail.' },
          { role: 'user', content: `Destination: ${destination}\nDates: ${dates}\nBudget: ${budget}\nStyle: ${style}\nInterests: ${interests.join(', ')}\n\nCreate a complete itinerary with: day-by-day schedule, specific hotel recommendations (with booking notes), restaurant reservations needed, hidden gems, and packing list. Include backup options.` },
        ];
        const itinerary = await ctx.ai(prompt, { max_tokens: 3000 });
        return { destination, itinerary };
      }

      case 'restaurant_research': {
        const { city, cuisine, occasion, budget_per_person, party_size = 2 } = data;
        const prompt = [
          { role: 'system', content: 'You are a dining intelligence AI with deep restaurant knowledge.' },
          { role: 'user', content: `City: ${city}\nCuisine: ${cuisine}\nOccasion: ${occasion}\nBudget: $${budget_per_person}/person\nParty size: ${party_size}\n\nRecommend 5 restaurants with: reservation difficulty (1-5), best dishes, optimal table/seating, dress code, parking, and what to say when reserving.` },
        ];
        const research = await ctx.ai(prompt, { max_tokens: 2000 });
        return { city, research };
      }

      case 'task_automation': {
        const { task: userTask, context: taskContext = '', tools_available = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are an efficiency AI. Design automation workflows and step-by-step execution plans.' },
          { role: 'user', content: `Task: "${userTask}"\nContext: ${taskContext}\nAvailable tools: ${tools_available.join(', ')}\n\nCreate: 1) step-by-step automation blueprint, 2) time estimate, 3) tools/services needed, 4) error handling, 5) how to verify completion` },
        ];
        const blueprint = await ctx.ai(prompt, { max_tokens: 1500 });
        return { task: userTask, blueprint };
      }

      case 'vendor_research': {
        const { service_type, location, requirements = [], budget = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are a vendor intelligence AI. Research and compare service providers.' },
          { role: 'user', content: `Service: ${service_type}\nLocation: ${location}\nRequirements: ${requirements.join(', ')}\nBudget: ${budget}\n\nProvide: top vendors to research, key questions to ask, red flags to avoid, price benchmarks, contract terms to negotiate.` },
        ];
        const research = await ctx.ai(prompt, { max_tokens: 1500 });
        return { service_type, research };
      }

      case 'event_access': {
        const { event, date, location, priority = 'high' } = data;
        const prompt = [
          { role: 'system', content: 'You are a VIP access intelligence AI. Find every legitimate path to exclusive events.' },
          { role: 'user', content: `Event: ${event}\nDate: ${date}\nLocation: ${location}\nPriority: ${priority}\n\nMap all access paths: official channels, secondary markets, industry connections, sponsor access, press credentials, and timing strategies.` },
        ];
        const paths = await ctx.ai(prompt, { max_tokens: 1200 });
        return { event, paths };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['travel_plan', 'restaurant_research', 'task_automation', 'vendor_research', 'event_access'] };
    }
  },
};
