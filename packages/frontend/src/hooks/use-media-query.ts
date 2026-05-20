import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQueryList = window.matchMedia(query)
      setMatches(mediaQueryList.matches)

      const listener = (e: MediaQueryListEvent) => {
        setMatches(e.matches)
      }

      mediaQueryList.addEventListener("change", listener)
      return () => mediaQueryList.removeEventListener("change", listener)
    }
    return undefined
  }, [query])

  return matches
}