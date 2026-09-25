"""Adapter registry: maps the 'adapter' name used in indicators.json to a fetch function."""
from . import ilostat, nhm, owid, pip, sdg, ucdp, who, whr, worldbank

ADAPTERS = {
    "worldbank": worldbank.fetch,
    "pip_mean": pip.fetch_mean,
    "pip_spl": pip.fetch_spl,
    "sdg": sdg.fetch,
    "ilostat": ilostat.fetch,
    "owid_grapher": owid.fetch_grapher,
    "owid_indicator": owid.fetch_indicator,
    "who_gho": who.fetch,
    "ucdp": ucdp.fetch,
    "nhm_bii": nhm.fetch,
    "whr": whr.fetch,
}

PROVIDERS = {
    "worldbank": ("World Bank Indicators API", "https://data.worldbank.org/"),
    "pip_mean": ("World Bank Poverty & Inequality Platform", "https://pip.worldbank.org/"),
    "pip_spl": ("World Bank Poverty & Inequality Platform", "https://pip.worldbank.org/"),
    "sdg": ("UN SDG Global Database", "https://unstats.un.org/sdgs/dataportal"),
    "ilostat": ("ILOSTAT", "https://ilostat.ilo.org/"),
    "owid_grapher": ("Our World in Data", "https://ourworldindata.org/"),
    "owid_indicator": ("Our World in Data", "https://ourworldindata.org/"),
    "who_gho": ("WHO Global Health Observatory", "https://www.who.int/data/gho"),
    "ucdp": ("Uppsala Conflict Data Program", "https://ucdp.uu.se/"),
    "nhm_bii": ("Natural History Museum Data Portal", "https://data.nhm.ac.uk/"),
    "whr": ("World Happiness Report", "https://worldhappiness.report/"),
}
