import Link from 'next/link'

export default () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-4xl font-bold mb-8">Computer Builder</h1>
            <div className="flex space-x-4">
                <Link href="/free" className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                    Free Build
                </Link>
                <Link href="/build" className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                    Tutorial: How to Build a Computer
                </Link>
            </div>
        </div>
    )
}
