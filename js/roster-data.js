const TEAMS = {
  White: {
    name: "Team White",
    color: "#FFFFFF",
    accentColor: "#6CACE4",
    players: [
      { number: 3, name: "Owen Phelan" },
      { number: 5, name: "Hudson Layman" },
      { number: 7, name: "Will Howard" },
      { number: 9, name: "Liam McNally" },
      { number: 14, name: "Ja'Mauree Tarango" },
      { number: 21, name: "Truett Williams" },
      { number: 32, name: "Zach Benitez" },
      { number: 33, name: "Cael Kissane" },
      { number: 34, name: "Brody Lemmons" }
    ]
  },
  Blue: {
    name: "Team Blue",
    color: "#6CACE4",
    accentColor: "#1B2A4A",
    players: [
      { number: 0, name: "Hayes Tarpenning" },
      { number: 1, name: "Cook Franchie" },
      { number: 2, name: "Tyson Deveau" },
      { number: 8, name: "Cy Steppenbacker" },
      { number: 10, name: "Kayden Pellizzari" },
      { number: 15, name: "Cody Krc-Holum" },
      { number: 20, name: "Nikolas Baltzer" },
      { number: 24, name: "Nick Fajardo" },
      { number: 50, name: "Ezra Paligo" }
    ]
  }
};

const STAT_FIELDS = [
  "fg_made", "fg_attempted",
  "three_pt_made", "three_pt_attempted",
  "ft_made", "ft_attempted",
  "o_rebounds", "d_rebounds",
  "assists", "steals",
  "jump_balls", "blocks",
  "turnovers", "fouls"
];
