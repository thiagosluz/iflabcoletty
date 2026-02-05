import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Search } from "lucide-react"
import apiClient from "@/lib/axios"

interface SearchComputer { id: number; hostname?: string; machine_id?: string; lab?: { name: string } }
interface SearchLab { id: number; name: string }
interface SearchSoftware { id: number; name: string; version?: string }
interface SearchResults {
  computers: SearchComputer[];
  labs: SearchLab[];
  softwares: SearchSoftware[];
  users: unknown[];
}

const emptyResults: SearchResults = { computers: [], labs: [], softwares: [], users: [] }

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResults>(emptyResults)
  const navigate = useNavigate()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  React.useEffect(() => {
    if (query.length < 2) {
      setResults(emptyResults)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get<SearchResults>(`/search?q=${query}`)
        setResults(data ?? emptyResults)
      } catch (e) {
        console.error(e)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <button
        onClick={() => {
            setOpen(true);
            setQuery("");
            setResults(emptyResults);
        }}
        className="inline-flex items-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64 relative"
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Buscar...</span>
        <span className="inline-flex lg:hidden">Buscar...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput placeholder="Digite para buscar..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          
          {results.computers.length > 0 && (
            <CommandGroup heading="Computadores">
              {results.computers.map((pc: SearchComputer) => (
                <CommandItem key={pc.id} onSelect={() => runCommand(() => navigate(`/admin/computers/${pc.id}`))}>
                  <div className="flex flex-col">
                    <span>{pc.hostname || pc.machine_id}</span>
                    <span className="text-xs text-muted-foreground">{pc.lab?.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.labs.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Laboratórios">
                {results.labs.map((lab: SearchLab) => (
                  <CommandItem key={lab.id} onSelect={() => runCommand(() => navigate(`/admin/labs/${lab.id}`))}>
                    <span>{lab.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results.softwares.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Softwares">
                {results.softwares.map((sw: SearchSoftware) => (
                  <CommandItem key={sw.id} onSelect={() => runCommand(() => navigate(`/admin/softwares?search=${sw.name}`))}>
                    <div className="flex flex-col">
                        <span>{sw.name}</span>
                        <span className="text-xs text-muted-foreground">{sw.version}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
