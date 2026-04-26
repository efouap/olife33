'use strict';

module.exports = {
  describe() {
    return {
      mission: 'M2 — Efficiency (Booking)',
      capabilities: ['flight_research', 'hotel_research', 'points_optimizer', 'booking_timing', 'upgrade_strategy'],
    };
  },

  async run(payload, ctx) {
    const { task, data = {} } = payload;

    switch (task) {
      case 'flight_research': {
        const { origin, destination, dates, class: cabinClass = 'economy', flexibility_days = 3 } = data;
        const prompt = [
          { role: 'system', content: 'You are O LIFE Booking Intelligence. Optimize travel booking with price intelligence and timing strategies.' },
          { role: 'user', content: `Route: ${origin} → ${destination}\nDates: ${dates}\nClass: ${cabinClass}\nFlexibility: ±${flexibility_days} days\n\nProvide: 1) best booking windows, 2) airlines to compare, 3) flexible date recommendations, 4) hidden-city or positioning flight opportunities, 5) price drop alert triggers` },
        ];
        const research = await ctx.ai(prompt, { max_tokens: 1500 });
        return { origin, destination, research };
      }

      case 'hotel_research': {
        const { city, check_in, check_out, category = '4-star', priorities = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a hotel intelligence AI with deep knowledge of loyalty programs and booking strategies.' },
          { role: 'user', content: `City: ${city}\nDates: ${check_in} – ${check_out}\nCategory: ${category}\nPriorities: ${priorities.join(', ')}\n\nRecommend: top hotels, rate strategies (book direct vs OTA), negotiation scripts, room upgrade tactics, and loyalty program advantages.` },
        ];
        const research = await ctx.ai(prompt, { max_tokens: 1800 });
        return { city, research };
      }

      case 'points_optimizer': {
        const { programs = {}, upcoming_trips = [] } = data;
        const prompt = [
          { role: 'system', content: 'You are a travel rewards optimization AI. Maximize value from loyalty programs.' },
          { role: 'user', content: `Points balances: ${JSON.stringify(programs)}\nUpcoming trips: ${upcoming_trips.join(', ')}\n\nProvide: 1) best redemptions for each trip, 2) points value analysis (cpp), 3) transfer partner opportunities, 4) status benefits to leverage, 5) earning acceleration strategies` },
        ];
        const optimization = await ctx.ai(prompt, { max_tokens: 2000 });
        return { optimization };
      }

      case 'booking_timing': {
        const { travel_type, destination, desired_dates } = data;
        const prompt = [
          { role: 'system', content: 'You are a booking timing intelligence AI with knowledge of pricing patterns.' },
          { role: 'user', content: `Type: ${travel_type}\nDestination: ${destination}\nDesired dates: ${desired_dates}\n\nProvide: optimal booking window, day-of-week to book, time of day for best prices, seasonal pricing patterns, and when to use flexible dates.` },
        ];
        const timing = await ctx.ai(prompt, { max_tokens: 1000 });
        return { timing };
      }

      case 'upgrade_strategy': {
        const { airline_or_hotel, current_status, route_or_property, booking_class = '' } = data;
        const prompt = [
          { role: 'system', content: 'You are an upgrade intelligence AI. Find every legitimate path to complimentary upgrades.' },
          { role: 'user', content: `Provider: ${airline_or_hotel}\nStatus: ${current_status}\nRoute/Property: ${route_or_property}\nBooking class: ${booking_class}\n\nMap upgrade paths: 1) status-based upgrades, 2) bid upgrade programs, 3) check-in timing, 4) agent interaction scripts, 5) booking class strategies` },
        ];
        const strategy = await ctx.ai(prompt, { max_tokens: 1200 });
        return { strategy };
      }

      default:
        return { error: `Unknown task: ${task}`, available_tasks: ['flight_research', 'hotel_research', 'points_optimizer', 'booking_timing', 'upgrade_strategy'] };
    }
  },
};
