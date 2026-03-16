export default function RoadmapTimeline({ roadmap }) {

  return (

    <div className="relative max-w-5xl mx-auto mt-16">

      <div className="absolute left-1/2 transform -translate-x-1/2 w-[3px] h-full bg-purple-600"></div>

      {roadmap.map((month, i) => (

        <div
          key={i}
          className={`flex items-center mb-16 ${
            i % 2 === 0 ? "justify-start" : "justify-end"
          }`}
        >

          <div className="w-[45%] bg-[#0f0f0f] border border-purple-500/20 rounded-xl p-6 shadow-lg">

            <h2 className="text-xl font-bold text-purple-400 mb-4">
              {month.month}
            </h2>

            {month.weeks.map((week, index) => (

              <div key={index} className="mb-3">

                <p className="text-purple-300 font-semibold">
                  {week.week}
                </p>

                <p className="text-gray-400 text-sm">
                  {week.topic}
                </p>

              </div>

            ))}

          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-purple-600 rounded-full border-4 border-black"></div>

        </div>

      ))}

    </div>

  );

}